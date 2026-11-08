import os
import io
import logging
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from PIL import Image
import numpy as np

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── App setup ────────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder="frontend", static_url_path="")
CORS(app)

# ─── Model constants (matching Kaggle notebook) ───────────────────────────────
IMG_SIZE = (224, 224)
CLASSES = ["Plain", "Pothole"]   # index 0 = Plain, index 1 = Pothole
MODEL_PATHS = [
    "model/pothole_model.keras",
    "model/pothole_model.h5",
    "model/final_pothole_classifier.keras",
    "model/baseline_frozen.keras",
    "model/finetuned_mobilenetv2.keras",
    "model/model.h5",
    "model/model.keras",
    "pothole_model.h5",
    "pothole_model.keras",
]

model = None
model_loaded = False
model_error = ""

# ─── Try loading the model ────────────────────────────────────────────────────
def load_keras_model():
    global model, model_loaded, model_error
    try:
        import tensorflow as tf
        for path in MODEL_PATHS:
            if os.path.exists(path):
                logger.info(f"Loading model from {path} ...")
                try:
                    model = tf.keras.models.load_model(path, compile=False)
                except Exception:
                    import keras
                    model = keras.models.load_model(path, compile=False)
                model_loaded = True
                model_error = ""
                logger.info("Model loaded successfully.")
                return
        model_error = (
            "No model file found. Place your trained .h5 or .keras file "
            "in the model/ directory (e.g. model/pothole_model.h5) and restart."
        )
        logger.warning(model_error)
    except ImportError:
        model_error = "TensorFlow is not installed. Run: pip install tensorflow"
        logger.warning(model_error)
    except Exception as e:
        model_error = f"Failed to load model: {str(e)}"
        logger.error(model_error)


load_keras_model()


# ─── Image preprocessing ──────────────────────────────────────────────────────
def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """Resize + normalise exactly as done in the Kaggle notebook."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(IMG_SIZE, Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0   # rescale=1./255
    return np.expand_dims(arr, axis=0)               # (1, 224, 224, 3)


# ─── Routes ───────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")


@app.route("/api/status")
def status():
    return jsonify({
        "model_loaded": model_loaded,
        "model_error": model_error,
        "classes": CLASSES,
        "input_size": list(IMG_SIZE),
    })


@app.route("/api/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["image"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    # Validate file type
    allowed = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    ext = Path(str(file.filename)).suffix.lower()
    if ext not in allowed:
        return jsonify({"error": f"Unsupported file type: {ext}"}), 400

    image_bytes = file.read()

    # ── Live prediction ──────────────────────────────────────────────────────
    if model_loaded and model is not None:
        try:
            x = preprocess_image(image_bytes)
            raw = model.predict(x, verbose=0)

            # Sigmoid output -> probability of class 1 (Pothole)
            prob_pothole = float(raw[0][0])
            prob_plain   = 1.0 - prob_pothole

            if prob_pothole >= 0.5:
                predicted_class = "Pothole"
                confidence      = prob_pothole
            else:
                predicted_class = "Plain"
                confidence      = prob_plain

            return jsonify({
                "predicted_class": predicted_class,
                "confidence": round(confidence * 100, 2),
                "probabilities": {
                    "Plain":   round(prob_plain   * 100, 2),
                    "Pothole": round(prob_pothole  * 100, 2),
                },
                "model_used": True,
            })
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            return jsonify({"error": f"Prediction failed: {str(e)}"}), 500

    # ── No model available ───────────────────────────────────────────────────
    return jsonify({
        "model_used": False,
        "error": model_error or "Model not loaded",
    }), 503


@app.route("/api/model-info")
def model_info():
    """Returns static project/model metadata (no fabricated numbers)."""
    return jsonify({
        "architecture":   "MobileNetV2 (Transfer Learning)",
        "backbone":       "MobileNetV2 pretrained on ImageNet",
        "head":           "GlobalAveragePooling2D -> Dense(128, ReLU) -> Dropout -> Dense(1, Sigmoid)",
        "input_shape":    [224, 224, 3],
        "output_classes": CLASSES,
        "framework":      "TensorFlow / Keras",
        "dataset": {
            "source":     "Kaggle – virenbr11/pothole-and-plain-road-images-images",
            "train":      "~510 images",
            "validation": "~109 images",
            "test":       "~113 images",
        },
        "preprocessing": {
            "resize":         "224 × 224",
            "normalisation":  "pixel / 255",
            "augmentation": [
                "rotation_range=15",
                "width_shift_range=0.1",
                "height_shift_range=0.1",
                "zoom_range=0.1",
                "horizontal_flip=True",
            ],
        },
        "limitations": [
            "Performance may degrade on images taken in extreme lighting.",
            "Model trained on limited dataset (~730 images total).",
            "Binary classification only – does not assess pothole severity.",
            "May not generalise to regions not represented in training data.",
        ],
    })


if __name__ == "__main__":
    os.makedirs("model", exist_ok=True)
    app.run(debug=False, host="0.0.0.0", port=5000)
