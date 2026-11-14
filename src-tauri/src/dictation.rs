use std::{
    fs::{self, File},
    io,
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
        mpsc::{self, RecvTimeoutError, SyncSender},
    },
    thread,
    time::Duration,
};

use cpal::{
    Device, InputCallbackInfo, SampleFormat, Stream, StreamConfig,
    traits::{DeviceTrait, HostTrait, StreamTrait},
};
use sherpa_onnx::{OfflineRecognizer, OfflineRecognizerConfig, OfflineWhisperModelConfig};
use tauri::{AppHandle, Emitter, Manager, State};

const MODEL_URL: &str = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-tiny.tar.bz2";
const MODEL_DIR: &str = "sherpa-onnx-whisper-tiny";
const SAMPLE_RATE: u32 = 16_000;
const SEGMENT_SECONDS: usize = 5;

#[derive(Clone, Default)]
pub struct DictationState {
    busy: Arc<AtomicBool>,
    session: Arc<Mutex<Option<DictationSession>>>,
}

struct DictationSession {
    stopping: Arc<AtomicBool>,
}

enum AudioMessage {
    Samples(Vec<f32>),
}

#[derive(Clone, serde::Serialize)]
struct DictationStatus {
    message: String,
}

fn emit_status(app: &AppHandle, message: impl Into<String>) {
    let _ = app.emit(
        "dictation-status",
        DictationStatus {
            message: message.into(),
        },
    );
}

#[tauri::command]
pub async fn start_dictation(
    app: AppHandle,
    state: State<'_, DictationState>,
) -> Result<(), String> {
    let state = state.inner().clone();
    if state.busy.swap(true, Ordering::AcqRel) {
        return Err("El dictado ya está activo.".into());
    }

    let stopping = Arc::new(AtomicBool::new(false));
    {
        let mut session = state
            .session
            .lock()
            .map_err(|_| "No se pudo preparar la sesión de dictado.".to_string())?;
        *session = Some(DictationSession {
            stopping: Arc::clone(&stopping),
        });
    }

    let worker_state = state.clone();
    let worker_stopping = Arc::clone(&stopping);
    let result = tauri::async_runtime::spawn_blocking(move || {
        start_blocking(app, worker_state, worker_stopping)
    })
    .await
    .map_err(|error| format!("Falló la tarea de dictado: {error}"))
    .and_then(|result| result);

    if result.is_err() {
        if let Ok(mut session) = state.session.lock() {
            session.take();
        }
        state.busy.store(false, Ordering::Release);
    }
    result
}

#[tauri::command]
pub fn stop_dictation(state: State<'_, DictationState>) {
    let session = state
        .session
        .lock()
        .ok()
        .and_then(|mut session| session.take());
    if let Some(session) = session {
        session.stopping.store(true, Ordering::Release);
    }
}

fn start_blocking(
    app: AppHandle,
    state: DictationState,
    stopping: Arc<AtomicBool>,
) -> Result<(), String> {
    emit_status(&app, "Preparando el dictado…");
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("No se pudo abrir el almacenamiento de la app: {error}"))?;
    let model_dir = ensure_model(&data_dir, &app)?;
    if stopping.load(Ordering::Acquire) {
        return Err("Se canceló la preparación del dictado.".into());
    }
    emit_status(&app, "Cargando el modelo local…");

    let mut config = OfflineRecognizerConfig::default();
    config.model_config.whisper = OfflineWhisperModelConfig {
        encoder: Some(
            model_dir
                .join("tiny-encoder.int8.onnx")
                .to_string_lossy()
                .into_owned(),
        ),
        decoder: Some(
            model_dir
                .join("tiny-decoder.onnx")
                .to_string_lossy()
                .into_owned(),
        ),
        language: Some("es".into()),
        task: Some("transcribe".into()),
        ..Default::default()
    };
    config.model_config.tokens = Some(
        model_dir
            .join("tiny-tokens.txt")
            .to_string_lossy()
            .into_owned(),
    );
    config.model_config.num_threads = 2;
    config.model_config.provider = Some("cpu".into());
    let recognizer = OfflineRecognizer::create(&config)
        .ok_or_else(|| "No se pudo cargar el modelo de voz.".to_string())?;
    let worker_stopping = Arc::clone(&stopping);
    let worker_app = app.clone();
    let worker_busy = Arc::clone(&state.busy);
    let worker_state = state.clone();
    let (ready_tx, ready_rx) = mpsc::sync_channel(1);

    thread::Builder::new()
        .name("mimo-voice-dictation".into())
        .spawn(move || {
            let result = run_session(worker_app.clone(), recognizer, worker_stopping, ready_tx);
            if let Err(error) = result {
                emit_status(&worker_app, error);
            }
            if let Ok(mut session) = worker_state.session.lock() {
                session.take();
            }
            worker_busy.store(false, Ordering::Release);
        })
        .map_err(|error| format!("No se pudo iniciar el dictado: {error}"))?;

    ready_rx
        .recv()
        .map_err(|error| format!("No se pudo iniciar la captura de voz: {error}"))??;

    emit_status(&app, "Escuchando… habla para transcribir.");
    Ok(())
}

fn run_session(
    app: AppHandle,
    recognizer: OfflineRecognizer,
    stopping: Arc<AtomicBool>,
    ready: mpsc::SyncSender<Result<(), String>>,
) -> Result<(), String> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "No se encontró un micrófono de entrada.".to_string());
    let device = match device {
        Ok(device) => device,
        Err(error) => {
            let _ = ready.send(Err(error.clone()));
            return Err(error);
        }
    };
    let supported = device
        .default_input_config()
        .map_err(|error| format!("No se pudo abrir el micrófono: {error}"));
    let supported = match supported {
        Ok(supported) => supported,
        Err(error) => {
            let _ = ready.send(Err(error.clone()));
            return Err(error);
        }
    };
    let input_rate = supported.sample_rate().0;
    let channels = supported.channels() as usize;
    let sample_format = supported.sample_format();
    let stream_config: StreamConfig = supported.into();
    let (audio_tx, audio_rx) = mpsc::sync_channel(16);
    let stream = match make_input_stream(&device, &stream_config, sample_format, audio_tx) {
        Ok(stream) => stream,
        Err(error) => {
            let _ = ready.send(Err(error.clone()));
            return Err(error);
        }
    };
    if let Err(error) = stream.play() {
        let message = format!("No se pudo activar el micrófono: {error}");
        let _ = ready.send(Err(message.clone()));
        return Err(message);
    }

    let _ = ready.send(Ok(()));
    emit_status(&app, "Escuchando… habla para transcribir.");
    transcribe_audio(app, recognizer, audio_rx, stopping, input_rate, channels);
    drop(stream);
    Ok(())
}

fn ensure_model(data_dir: &Path, app: &AppHandle) -> Result<PathBuf, String> {
    let model_dir = data_dir.join(MODEL_DIR);
    let encoder = model_dir.join("tiny-encoder.int8.onnx");
    let decoder = model_dir.join("tiny-decoder.onnx");
    let tokens = model_dir.join("tiny-tokens.txt");
    if encoder.is_file() && decoder.is_file() && tokens.is_file() {
        return Ok(model_dir);
    }

    emit_status(app, "Descargando el modelo de voz (solo la primera vez)…");
    fs::create_dir_all(data_dir)
        .map_err(|error| format!("No se pudo crear la carpeta de modelos: {error}"))?;
    let staging = data_dir.join(format!("{MODEL_DIR}.download"));
    if staging.exists() {
        fs::remove_dir_all(&staging)
            .map_err(|error| format!("No se pudo limpiar la descarga anterior: {error}"))?;
    }
    fs::create_dir_all(&staging)
        .map_err(|error| format!("No se pudo preparar la descarga: {error}"))?;

    let result = (|| {
        let response = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(600))
            .build()
            .map_err(|error| format!("No se pudo iniciar la descarga del modelo: {error}"))?
            .get(MODEL_URL)
            .send()
            .and_then(reqwest::blocking::Response::error_for_status)
            .map_err(|error| format!("No se pudo descargar el modelo de voz: {error}"))?;
        let decoder = bzip2::read::BzDecoder::new(response);
        let mut archive = tar::Archive::new(decoder);
        let mut found = 0;
        for entry in archive
            .entries()
            .map_err(|error| format!("El archivo del modelo no se pudo leer: {error}"))?
        {
            let mut entry =
                entry.map_err(|error| format!("El archivo del modelo está dañado: {error}"))?;
            if !entry.header().entry_type().is_file() {
                continue;
            }
            let filename = entry
                .path()
                .ok()
                .and_then(|path| path.file_name().map(|name| name.to_owned()));
            let Some(filename) = filename else { continue };
            let name = filename.to_string_lossy();
            if ![
                "tiny-encoder.int8.onnx",
                "tiny-decoder.onnx",
                "tiny-tokens.txt",
            ]
            .contains(&name.as_ref())
            {
                continue;
            }
            let mut output = File::create(staging.join(name.as_ref()))
                .map_err(|error| format!("No se pudo guardar el modelo: {error}"))?;
            io::copy(&mut entry, &mut output)
                .map_err(|error| format!("No se pudo extraer el modelo: {error}"))?;
            found += 1;
        }
        if found != 3 {
            return Err("La descarga no contiene todos los archivos necesarios del modelo.".into());
        }
        for filename in [
            "tiny-encoder.int8.onnx",
            "tiny-decoder.onnx",
            "tiny-tokens.txt",
        ] {
            let size = fs::metadata(staging.join(filename))
                .map_err(|error| {
                    format!("El archivo {filename} del modelo está incompleto: {error}")
                })?
                .len();
            if size < 1024 {
                return Err(format!(
                    "El archivo {filename} del modelo está vacío o incompleto."
                ));
            }
        }
        if model_dir.exists() {
            fs::remove_dir_all(&model_dir)
                .map_err(|error| format!("No se pudo reemplazar el modelo anterior: {error}"))?;
        }
        fs::rename(&staging, &model_dir)
            .map_err(|error| format!("No se pudo instalar el modelo de voz: {error}"))?;
        Ok(model_dir.clone())
    })();

    if result.is_err() {
        let _ = fs::remove_dir_all(&staging);
    }
    result
}

fn make_input_stream(
    device: &Device,
    config: &StreamConfig,
    sample_format: SampleFormat,
    sender: SyncSender<AudioMessage>,
) -> Result<Stream, String> {
    let stream = match sample_format {
        SampleFormat::F32 => device.build_input_stream(
            config,
            move |data: &[f32], _: &InputCallbackInfo| {
                let _ = sender.try_send(AudioMessage::Samples(data.to_vec()));
            },
            |error| eprintln!("Microphone stream error: {error}"),
            None,
        ),
        SampleFormat::I16 => device.build_input_stream(
            config,
            move |data: &[i16], _: &InputCallbackInfo| {
                let samples = data
                    .iter()
                    .map(|sample| *sample as f32 / i16::MAX as f32)
                    .collect();
                let _ = sender.try_send(AudioMessage::Samples(samples));
            },
            |error| eprintln!("Microphone stream error: {error}"),
            None,
        ),
        SampleFormat::U16 => device.build_input_stream(
            config,
            move |data: &[u16], _: &InputCallbackInfo| {
                let samples = data
                    .iter()
                    .map(|sample| (*sample as f32 / u16::MAX as f32) * 2.0 - 1.0)
                    .collect();
                let _ = sender.try_send(AudioMessage::Samples(samples));
            },
            |error| eprintln!("Microphone stream error: {error}"),
            None,
        ),
        other => return Err(format!("El formato de audio {other:?} no está soportado.")),
    };
    stream.map_err(|error| format!("No se pudo configurar el micrófono: {error}"))
}

fn transcribe_audio(
    app: AppHandle,
    recognizer: OfflineRecognizer,
    receiver: mpsc::Receiver<AudioMessage>,
    stopping: Arc<AtomicBool>,
    input_rate: u32,
    channels: usize,
) {
    let segment_samples = input_rate as usize * channels * SEGMENT_SECONDS;
    let mut input = Vec::with_capacity(segment_samples);
    while !stopping.load(Ordering::Acquire) {
        match receiver.recv_timeout(Duration::from_millis(100)) {
            Ok(AudioMessage::Samples(samples)) => input.extend(samples),
            Err(RecvTimeoutError::Timeout) => continue,
            Err(RecvTimeoutError::Disconnected) => break,
        }
        while input.len() >= segment_samples {
            let remainder = input.split_off(segment_samples);
            let segment = std::mem::replace(&mut input, remainder);
            transcribe_segment(&app, &recognizer, &segment, input_rate, channels);
        }
    }

    while let Ok(AudioMessage::Samples(samples)) = receiver.try_recv() {
        input.extend(samples);
    }
    if input.len() >= input_rate as usize * channels / 2 {
        transcribe_segment(&app, &recognizer, &input, input_rate, channels);
    }
    emit_status(&app, "Dictado detenido.");
}

fn transcribe_segment(
    app: &AppHandle,
    recognizer: &OfflineRecognizer,
    input: &[f32],
    input_rate: u32,
    channels: usize,
) {
    let mono: Vec<f32> = input
        .chunks_exact(channels)
        .map(|frame| frame.iter().sum::<f32>() / channels as f32)
        .collect();
    let samples = resample(&mono, input_rate, SAMPLE_RATE);
    if samples.is_empty() {
        return;
    }
    let stream = recognizer.create_stream();
    stream.accept_waveform(SAMPLE_RATE as i32, &samples);
    recognizer.decode(&stream);
    if let Some(result) = stream.get_result() {
        let text = result.text.trim();
        if !text.is_empty() {
            let _ = app.emit("dictation-transcript", text.to_owned());
        }
    }
}

fn resample(samples: &[f32], source_rate: u32, target_rate: u32) -> Vec<f32> {
    if source_rate == target_rate || samples.is_empty() {
        return samples.to_vec();
    }
    let output_len = (samples.len() as u64 * target_rate as u64 / source_rate as u64) as usize;
    (0..output_len)
        .map(|index| {
            let position = index as f64 * source_rate as f64 / target_rate as f64;
            let left = position.floor() as usize;
            let right = (left + 1).min(samples.len() - 1);
            let fraction = (position - left as f64) as f32;
            samples[left] + (samples[right] - samples[left]) * fraction
        })
        .collect()
}
