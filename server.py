import os
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv
from ai import GeminiCropRecommender
import requests

# Load environment variables from .env file
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
GOV_KEY = os.getenv("SEED_API_KEY")
if not API_KEY or not GOV_KEY:
    raise RuntimeError("API_KEY not found in environment variables. Please set it in your .env file.")



app = Flask(__name__)
recommender = GeminiCropRecommender(api_key=API_KEY)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/recommend", methods=["POST"])
def recommend_crops():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid or missing JSON body."}), 400
    try:
        land_area_acres = data.get("land_area_acres")
        region = data.get("region")
        water_price_per_liter = data.get("water_price_per_liter")
        image = data.get("image")
        if land_area_acres is None or region is None or water_price_per_liter is None:
            return jsonify({"error": "Missing required fields: land_area_acres, region, water_price_per_liter."}), 400
        try:
            result = recommender.get_recommendation(
                land_area_acres=land_area_acres,
                region=region,
                water_price_per_liter=water_price_per_liter,
                image=image
            )
            return jsonify(result)
        except RuntimeError as gemini_error:
            return jsonify({"error": str(gemini_error)}), 502
        except ValueError as json_error:
            return jsonify({"error": str(json_error)}), 500
        except Exception as e:
            return jsonify({"error": f"Unexpected error: {e}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/getPrices', methods=['POST'])
def getPrices():
    searchOptions = [
        "Paddy",
        "Maize",
        "Moong",
        "Millet",
    ]
    data = request.get_json()
    if "crop" not in data or data["crop"] not in searchOptions:
        return jsonify({"error": "Invalid crop"}), 403
    
    print(data)
    
    url = f"https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key={GOV_KEY}&format=json&limit=50&filters%5Bcommodity%5D={data["crop"]}"
    fetchData = requests.get(url).json()
    totalRecords = int(fetchData["total"])

    if totalRecords == 0:
        return jsonify({"error": "data not found"}), 404
    
    minPrice, modPrice, maxPrice = 0, 0, 0
    for record in fetchData["records"]:
        minPrice += int(record["min_price"])
        modPrice += int(record["modal_price"])
        maxPrice += int(record["max_price"])

    return jsonify({"min":minPrice/totalRecords, "mod":modPrice/totalRecords, "max":maxPrice/totalRecords})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
