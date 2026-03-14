use base64::Engine;
use midir::{MidiInput, MidiInputConnection, MidiOutput, MidiOutputConnection};
use serde::Serialize;
use std::sync::Mutex;
use tauri::Emitter;
use tauri::State;

// ─── State ───────────────────────────────────────────────────────────────────

struct MidiState {
    output_conn: Mutex<Option<MidiOutputConnection>>,
    input_conn: Mutex<Option<MidiInputConnection<()>>>,
    // Keep a client alive so macOS CoreMIDI correctly updates devices natively via hot-plug
    _keepalive_in: Mutex<Option<MidiInput>>,
    _keepalive_out: Mutex<Option<MidiOutput>>,
}

#[derive(Serialize, Clone, Debug)]
struct MidiDevice {
    id: usize,
    name: String,
}

// ─── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
fn list_midi_inputs() -> Result<Vec<MidiDevice>, String> {
    let midi_in = MidiInput::new("505fx-scan-in").map_err(|e| e.to_string())?;
    let ports = midi_in.ports();
    let devices: Vec<MidiDevice> = ports
        .iter()
        .enumerate()
        .filter_map(|(i, port)| {
            let name = midi_in.port_name(port).ok()?;
            Some(MidiDevice { id: i, name })
        })
        .collect();
    Ok(devices)
}

#[tauri::command]
fn list_midi_outputs() -> Result<Vec<MidiDevice>, String> {
    let midi_out = MidiOutput::new("505fx-scan-out").map_err(|e| e.to_string())?;
    let ports = midi_out.ports();
    let devices: Vec<MidiDevice> = ports
        .iter()
        .enumerate()
        .filter_map(|(i, port)| {
            let name = midi_out.port_name(port).ok()?;
            Some(MidiDevice { id: i, name })
        })
        .collect();
    Ok(devices)
}

#[tauri::command]
fn connect_midi_output(state: State<MidiState>, port_index: usize) -> Result<String, String> {
    // Drop existing connection first
    {
        let mut lock = state.output_conn.lock().map_err(|e| e.to_string())?;
        *lock = None;
    }

    let midi_out = MidiOutput::new("505fx-out").map_err(|e| e.to_string())?;
    let ports = midi_out.ports();
    let port = ports
        .get(port_index)
        .ok_or_else(|| format!("Invalid port index {}", port_index))?;
    let name = midi_out
        .port_name(port)
        .unwrap_or_else(|_| "Unknown".into());
    let conn = midi_out
        .connect(port, "505fx-output")
        .map_err(|e| e.to_string())?;
    let mut lock = state.output_conn.lock().map_err(|e| e.to_string())?;
    *lock = Some(conn);
    Ok(name)
}

#[tauri::command]
fn connect_midi_input(
    app: tauri::AppHandle,
    state: State<MidiState>,
    port_index: usize,
) -> Result<String, String> {
    // Drop existing input connection first (this closes the previous port)
    {
        let mut lock = state.input_conn.lock().map_err(|e| e.to_string())?;
        *lock = None;
    }

    let midi_in = MidiInput::new("505fx-in").map_err(|e| e.to_string())?;
    let ports = midi_in.ports();
    let port = ports
        .get(port_index)
        .ok_or_else(|| format!("Invalid port index {}", port_index))?;
    let name = midi_in.port_name(port).unwrap_or_else(|_| "Unknown".into());

    let app_handle = app.clone();
    let conn = midi_in
        .connect(
            port,
            "505fx-input",
            move |_timestamp, message, _| {
                if message.is_empty() {
                    return;
                }
                let status = message[0];
                if status == 0xF8 {
                    let _ = app_handle.emit("midi-clock-tick", ());
                }
                if status == 0xFA || status == 0xFB {
                    let _ = app_handle.emit("midi-transport", "start");
                }
                if status == 0xFC {
                    let _ = app_handle.emit("midi-transport", "stop");
                }
            },
            (),
        )
        .map_err(|e| e.to_string())?;

    // Store connection in state (replaces leaked mem::forget)
    let mut lock = state.input_conn.lock().map_err(|e| e.to_string())?;
    *lock = Some(conn);

    Ok(name)
}

#[tauri::command]
fn disconnect_midi_input(state: State<MidiState>) -> Result<(), String> {
    let mut lock = state.input_conn.lock().map_err(|e| e.to_string())?;
    *lock = None;
    Ok(())
}

#[tauri::command]
fn disconnect_midi_output(state: State<MidiState>) -> Result<(), String> {
    let mut lock = state.output_conn.lock().map_err(|e| e.to_string())?;
    *lock = None;
    Ok(())
}

#[tauri::command]
fn send_midi_cc(state: State<MidiState>, channel: u8, cc: u8, value: u8) -> Result<(), String> {
    let mut lock = state.output_conn.lock().map_err(|e| e.to_string())?;
    if let Some(conn) = lock.as_mut() {
        let status = 0xB0 + (channel.min(15));
        conn.send(&[status, cc, value]).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("No MIDI output connected".to_string())
    }
}

#[tauri::command]
fn send_midi_pc(state: State<MidiState>, channel: u8, program: u8) -> Result<(), String> {
    let mut lock = state.output_conn.lock().map_err(|e| e.to_string())?;
    if let Some(conn) = lock.as_mut() {
        let status = 0xC0 + (channel.min(15));
        conn.send(&[status, program]).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("No MIDI output connected".to_string())
    }
}

#[tauri::command]
fn save_template(path: String, data: String) -> Result<(), String> {
    std::fs::write(&path, &data).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_template(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file_base64(path: String) -> Result<String, String> {
    let buf = std::fs::read(&path).map_err(|e| e.to_string())?;

    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);
    Ok(format!("data:{};base64,{}", mime, b64))
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(MidiState {
            output_conn: Mutex::new(None),
            input_conn: Mutex::new(None),
            _keepalive_in: Mutex::new(MidiInput::new("505fx-keepalive-in").ok()),
            _keepalive_out: Mutex::new(MidiOutput::new("505fx-keepalive-out").ok()),
        })
        .invoke_handler(tauri::generate_handler![
            list_midi_inputs,
            list_midi_outputs,
            connect_midi_output,
            connect_midi_input,
            disconnect_midi_input,
            disconnect_midi_output,
            send_midi_cc,
            send_midi_pc,
            save_template,
            load_template,
            read_file_base64,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

