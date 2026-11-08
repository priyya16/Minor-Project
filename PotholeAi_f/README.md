# PotholeAI – Road Surface Classification

> An AI-powered web dashboard for classifying road images as **Plain** or **Pothole**, built on a MobileNetV2 transfer-learning model trained in a Kaggle notebook.

---

## 🗂 Project Structure

```
PotholeAi/
├── app.py               # Flask backend + ML inference API
├── requirements.txt     # Python dependencies
├── README.md
├── model/               # ← Place your trained model file here
│   └── pothole_model.h5 (or .keras)
└── frontend/
    ├── index.html       # Single-page application
    ├── style.css        # Premium dark-theme styles
    └── main.js          # Upload, drag-drop, prediction UI logic
```

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

For live ML predictions, also install TensorFlow:

```bash
pip install tensorflow
```

### 2. (Optional) Add your trained model

Export the model from your Kaggle notebook:

```python
model.save("pothole_model.h5")
```

Copy `pothole_model.h5` (or `.keras`) into the `model/` folder.

### 3. Run the server

```bash
python app.py
```

Open **http://localhost:5000** in your browser.

---

## 🤖 Model Details

| Property        | Value                                 |
|-----------------|---------------------------------------|
| Architecture    | MobileNetV2 (Transfer Learning)       |
| Backbone        | ImageNet pretrained                   |
| Input shape     | 224 × 224 × 3                         |
| Output          | Sigmoid → Binary (Plain / Pothole)    |
| Normalisation   | pixel / 255                           |
| Framework       | TensorFlow / Keras                    |
| Dataset source  | virenbr11/pothole-and-plain-road-images-images |
| Train / Val / Test | ~510 / ~109 / ~113 images          |

---

## 🌐 Features

- **Landing page** — Project overview, architecture stats, animated hero.
- **Drag-and-drop upload** — Image preview with reset and re-analyse support.
- **Live predictions** — Real sigmoid probability scores when model is present.
- **Dashboard** — Dataset split, architecture diagram, training config, augmentation details.
- **Model info** — Limitations, preprocessing details, activation instructions.
- **Responsive** — Works on desktop, tablet, and mobile.

---

## ⚙️ API Endpoints

| Endpoint          | Method | Description                              |
|-------------------|--------|------------------------------------------|
| `/`               | GET    | Serves the frontend                      |
| `/api/status`     | GET    | Model load status                        |
| `/api/predict`    | POST   | Multipart image → prediction JSON        |
| `/api/model-info` | GET    | Static model metadata                    |

### Prediction response (model loaded)

```json
{
  "predicted_class": "Pothole",
  "confidence": 94.23,
  "probabilities": { "Plain": 5.77, "Pothole": 94.23 },
  "model_used": true
}
```

---

## 📌 Notes

- No accuracy numbers are fabricated. Exact metrics are in the [Kaggle notebook](https://www.kaggle.com/code/priyapedhadiya/pothole-and-plain-road-classification-final).
- If the model file is absent the UI runs fully but predictions return a 503 with a clear message.
