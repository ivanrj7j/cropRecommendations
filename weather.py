import openmeteo_requests
import pandas as pd
import requests_cache
from retry_requests import retry

class WeatherData:
    """
    A class to fetch and process weather data from the Open-Meteo API.
    """

    def __init__(self, latitude, longitude):
        """
        Initializes the WeatherData class with latitude and longitude.

        Args:
            latitude (float): The latitude of the location.
            longitude (float): The longitude of the location.
        """
        self.latitude = latitude
        self.longitude = longitude
        self._setup_client()

    def _setup_client(self):
        """
        Sets up the Open-Meteo API client with caching and retry functionality.
        This is a private helper method.
        """
        cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
        retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
        self.openmeteo = openmeteo_requests.Client(session=retry_session)

    def fetch_hourly_data(self, forecast_days=1):
        """
        Fetches hourly weather data for the specified location.

        Args:
            forecast_days (int): The number of days to forecast. Defaults to 1.

        Returns:
            pandas.DataFrame: A DataFrame containing the hourly weather data.
            None: If the API call fails or no data is returned.
        """
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": self.latitude,
            "longitude": self.longitude,
            "hourly": ["temperature_2m", "soil_moisture_0_to_1cm", "soil_moisture_1_to_3cm",
                       "wind_speed_10m", "rain", "showers", "snowfall"],
            "forecast_days": forecast_days,
        }

        try:
            responses = self.openmeteo.weather_api(url, params=params)
            if not responses:
                print("No data received from the API.")
                return None

            response = responses[0]
            hourly = response.Hourly()

            # Convert UTC to IST (UTC+5:30)
            ist = pd.Timestamp.now(tz='Asia/Kolkata').tz
            date_utc = pd.date_range(
                start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
                end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
                freq=pd.Timedelta(seconds=hourly.Interval()),
                inclusive="left"
            )
            date_ist = date_utc.tz_convert(ist)
            hourly_data = {
                "date": date_ist.strftime('%a, %d %b %Y %H:%M:%S IST').tolist()
            }
            # Map the hourly variables to the dictionary
            variables = [
                "temperature_2m", "soil_moisture_0_to_1cm", "soil_moisture_1_to_3cm",
                "wind_speed_10m", "rain", "showers", "snowfall"
            ]
            for i, var_name in enumerate(variables):
                hourly_data[var_name] = hourly.Variables(i).ValuesAsNumpy()
            hourly_dataframe = pd.DataFrame(data=hourly_data)
            return hourly_dataframe

        except Exception as e:
            print(f"An error occurred while fetching data: {e}")
            return None

# --- Example Usage ---

if __name__ == '__main__':
    # Create an instance of the class for a specific location (e.g., Berlin, Germany)
    berlin_weather = WeatherData(latitude=52.52, longitude=13.41)
    
    # Fetch the hourly weather data for 1 day
    hourly_df = berlin_weather.fetch_hourly_data(forecast_days=1)
    
    if hourly_df is not None:
        print("\nHourly Weather Data for Berlin:")
        print(hourly_df)

    # Example for another location (e.g., New York, USA)
    nyc_weather = WeatherData(latitude=40.71, longitude=-74.01)
    nyc_df = nyc_weather.fetch_hourly_data(forecast_days=2)

    if nyc_df is not None:
        print("\nHourly Weather Data for New York City:")
        print(nyc_df)