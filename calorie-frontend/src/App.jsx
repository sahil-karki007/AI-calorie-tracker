import { useState, useRef, useEffect } from "react";
import "./App.css";

const API_URL = `${import.meta.env.VITE_API_URL}/api/analyze/`;

const emptyForm = { name: "", portion: "", calories: "", carbs_g: "", protein_g: "", fat_g: "" };
const round1 = (n) => Math.round(n * 10) / 10;

function App() {
  const [preview, setPreview] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Totals are calculated from the list, so they always match the items
  const total = items.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      carbs_g: sum.carbs_g + item.carbs_g,
      protein_g: sum.protein_g + item.protein_g,
      fat_g: sum.fat_g + item.fat_g,
    }),
    { calories: 0, carbs_g: 0, protein_g: 0, fat_g: 0 }
  );

  // Send one image file to the backend and show the result
  const analyze = async (file) => {
    setPreview(URL.createObjectURL(file));
    setItems([]);
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch(API_URL, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.details ? `${data.error}: ${data.details}` : data.error || "Something went wrong"
        );
      }
      setItems(data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Ask the browser for camera access, then show the camera screen
  const openCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setError("Could not open the camera. Allow camera permission, or use Upload.");
    }
  };

  // Turn the camera off and hide the camera screen
  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  // Take a still picture from the live video (shrunk to 1024px), then analyze it
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");

    const MAX_SIZE = 1024;
    const scale = Math.min(1, MAX_SIZE / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        closeCamera();
        if (blob) analyze(new File([blob], "meal.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) analyze(file);
    e.target.value = "";
  };

  // Manual entry: keep the form fields in state as the user types
  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const addManualMeal = (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.calories === "") {
      setError("Enter at least a food name and calories.");
      return;
    }
    setError("");
    const newItem = {
      name: form.name.trim(),
      portion: form.portion.trim() || "manual entry",
      calories: Number(form.calories) || 0,
      carbs_g: Number(form.carbs_g) || 0,
      protein_g: Number(form.protein_g) || 0,
      fat_g: Number(form.fat_g) || 0,
    };
    setItems([...items, newItem]);
    setForm(emptyForm);
    setShowForm(false);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Connect the camera stream to the <video> element once it exists
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

  // Make sure the camera is turned off if the page is closed
  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return (
    <div className="app">
      <header className="header">
        <img src="/logo.svg" alt="" className="logo" />
        <div>
          <h1>AI Calorie Tracker</h1>
          <p className="subtitle">Snap your meal, know your macros</p>
        </div>
      </header>

      <div className="actions">
        <button className="camera-btn" onClick={openCamera} disabled={loading} aria-label="Open camera">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>

        <button className="secondary" onClick={() => fileInputRef.current.click()} disabled={loading}>
          Upload photo
        </button>
        <button className="secondary" onClick={() => setShowForm(!showForm)} disabled={loading}>
          + Add manually
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleUpload} />
      </div>

      {showForm && (
        <form className="manual-form" onSubmit={addManualMeal}>
          <input name="name" placeholder="Food name (e.g. Paneer sabzi)" value={form.name} onChange={handleFormChange} />
          <input name="portion" placeholder="Portion (optional, e.g. 1 bowl)" value={form.portion} onChange={handleFormChange} />
          <div className="row">
            <input name="calories" type="number" min="0" placeholder="Calories" value={form.calories} onChange={handleFormChange} />
            <input name="carbs_g" type="number" min="0" step="0.1" placeholder="Carbs (g)" value={form.carbs_g} onChange={handleFormChange} />
          </div>
          <div className="row">
            <input name="protein_g" type="number" min="0" step="0.1" placeholder="Protein (g)" value={form.protein_g} onChange={handleFormChange} />
            <input name="fat_g" type="number" min="0" step="0.1" placeholder="Fat (g)" value={form.fat_g} onChange={handleFormChange} />
          </div>
          <button type="submit">Add to meal</button>
        </form>
      )}

      {preview && <img className="preview" src={preview} alt="Your meal" />}

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <p>Analyzing your meal... this can take a few seconds.</p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {!loading && !preview && items.length === 0 && (
        <p className="hint">Tap the camera to scan a meal, or add one manually.</p>
      )}

      {items.length > 0 && (
        <div className="result">
          <div className="total">
            <p className="total-label">Total</p>
            <h2>{round1(total.calories)} <span>kcal</span></h2>
            <div className="macros">
              <div className="macro"><strong>{round1(total.carbs_g)} g</strong><span>Carbs</span></div>
              <div className="macro"><strong>{round1(total.protein_g)} g</strong><span>Protein</span></div>
              <div className="macro"><strong>{round1(total.fat_g)} g</strong><span>Fat</span></div>
            </div>
          </div>

          {items.map((item, i) => (
            <div className="item" key={i}>
              <div className="item-info">
                <strong>{item.name}</strong>
                <span className="portion">{item.portion}</span>
                <div className="chips">
                  <span className="chip carbs">C {item.carbs_g} g</span>
                  <span className="chip protein">P {item.protein_g} g</span>
                  <span className="chip fat">F {item.fat_g} g</span>
                </div>
              </div>
              <div className="item-cal">
                <strong>{item.calories}</strong>
                <span>kcal</span>
              </div>
              <button className="remove" onClick={() => removeItem(i)} aria-label={`Remove ${item.name}`}>✕</button>
            </div>
          ))}
        </div>
      )}

      {cameraOpen && (
        <div className="camera-overlay">
          <video ref={videoRef} autoPlay playsInline muted />
          <div className="camera-controls">
            <button className="secondary" onClick={closeCamera}>Cancel</button>
            <button onClick={capturePhoto}>Capture</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;