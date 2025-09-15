import google.generativeai as genai
import json

class GeminiCropRecommender:
    """
    A class to interact with a Gemini model for generating crop recommendations.
    """
    
    def __init__(self, api_key: str, model_name: str = "gemini-2.0-flash-lite"):
        """
        Initializes the GeminiCropRecommender with an API key and model name.
        Args:
            api_key: Your Google Gemini API key.
            model_name: The name of the Gemini model to use.
        """
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name)

    def get_recommendation(self, land_area_acres: float, region: str, water_price_per_liter: float, image: str = None) -> dict:
        """
        Generates crop recommendations based on the provided data.
        Args:
            land_area_acres: Land area in acres.
            region: Geographical region or location.
            water_price_per_liter: Price of water per liter in local currency.
            image: Base64 encoded image of the land (optional).
        Returns:
            A dictionary containing the crop recommendations.
        Raises:
            Exception: If the Gemini model returns an error or invalid JSON.
        """
        # Build the prompt with user data
        prompt_template = """
You are an AI agricultural consultant. Your task is to provide expert recommendations for crop cultivation based on specific user-provided data.

User Data:
- Land area: {land_area_acres} acres
- Region: {region}
- Water price: {water_price_per_liter} per liter
- Land image (optional): [If an image is provided, analyze it for soil type, topography, and any visible plant life. Otherwise, state that no image was provided.]

Instructions:
1.  **Analyze the data**: Based on the provided land area (in acres), region, and water price, conduct a comprehensive web search to identify the most suitable crops. Consider factors such as climate, soil conditions, and water requirements.
2.  **Local Pricing**: When estimating costs for seeds, tools, and fertilizers, use the most recent and realistic local prices specifically for Jharkhand, India. If the region is Jharkhand or not specified, always use Jharkhand's local market prices for seeds, tools, and fertilizers. Clearly state if any price is an estimate based on Jharkhand's market.
3.  **Generate recommendations**: Provide a list of four (4) of the most viable crop recommendations for the specified region.
4.  **For each crop recommendation, provide the following details**:
        a.  **Crop Name**: The name of the recommended crop.
        b.  **Best Seeds**: A list of at least two specific, high-yield seed varieties or types suitable for the region.
        c.  **Required Tools**: A list of essential tools and equipment needed for planting, maintenance, and harvesting of the crop.
        d.  **Cost Estimate**: Provide a detailed cost breakdown for a one-year cultivation period for the specified land area (in acres). The cost breakdown should include:
                -   Total estimated cost.
                -   Itemized costs for seeds, water, fertilizer, tools/equipment, and labor.
                -   All costs should be in the local currency of the region, based on the provided water price.
                -   For seeds, tools, and fertilizers, use local prices from Jharkhand, India.
5.  **Formatting**: Format your response as a JSON object, adhering strictly to the schema provided below. Do not include any explanatory text or conversational filler outside of the JSON block.

Output Schema:
```json
{{
    "crop_recommendations": [
        {{
            "crop_name": "string",
            "best_seeds": [
                "string"
            ],
            "estimated_cost_per_year": {{
                "total_cost": "number",
                "breakdown": {{
                    "seeds": "number",
                    "water": "number",
                    "fertilizer": "number",
                    "tools_and_equipment": "number",
                    "labor": "number"
                }}
            }},
            "required_tools": [
                "string"
            ]
        }}
    ]
}}
```
                """.format(
                        land_area_acres=land_area_acres,
                        region=region,
                        water_price_per_liter=water_price_per_liter
                )

        # Handle multimodal input if an image is provided
        if image:
            contents = [
                prompt_template,
                {"text": "Land image provided, please analyze it."}
            ]
        else:
            contents = [prompt_template]

        try:
            response = self.model.generate_content(contents, stream=False)
        except Exception as api_exc:
            # Handle Gemini API errors
            error_msg = f"Gemini API error: {getattr(api_exc, 'message', str(api_exc))}"
            raise RuntimeError(error_msg)

        # Extract the JSON string from the response and parse it
        response_text = response.text.strip().replace("```json", "").replace("```", "")
        try:
            recommendations = json.loads(response_text)
        except Exception as json_exc:
            raise ValueError(f"Failed to parse Gemini response as JSON: {json_exc}\nRaw response: {response.text}")

        return recommendations

# Example Usage:
if __name__ == '__main__':
    # Replace 'YOUR_API_KEY' with your actual Gemini API key
    api_key = "YOUR_API_KEY"
    
    # Instantiate the recommender class
    recommender = GeminiCropRecommender(api_key=api_key)
    
    # Define user input data
    user_data = {
        "land_area_sqm": 5000,
        "region": "Punjab, India",
        "water_price_per_liter": 0.05, # Example price in local currency
        "image": None # Can be a base64 string of an image
    }
    
    try:
        # Get recommendations
        recommendations = recommender.get_recommendation(**user_data)
        
        # Print the result in a readable format
        print(json.dumps(recommendations, indent=2))
        
    except Exception as e:
        print(f"Failed to get recommendations: {e}")