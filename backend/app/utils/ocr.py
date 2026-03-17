import pytesseract
from PIL import Image

# Set path to tesseract.exe
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def extract_text_from_image(image_path):

    image = Image.open(image_path)

    text = pytesseract.image_to_string(image)

    return text