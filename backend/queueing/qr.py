import io
import base64
import qrcode


def generate_qr_data_uri(text: str, box_size: int = 6, border: int = 2) -> str:
    """
    Generates a base64 Data URI PNG string for a given text payload.
    Used for embedding QR codes into responsive HTML templates and thermal slips.
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0305ba", back_color="white")  # DOLE blue fill for crisp branding
    
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"
