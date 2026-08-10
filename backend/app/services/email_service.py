import resend
from app.core.config import settings

# The resend package is a module with a top-level `api_key`, not a class you
# instantiate — `from resend import Resend` doesn't exist and would fail on import.
resend.api_key = settings.resend_api_key

async def send_receipt_email(
    to_email: str,
    order_id: str,
    amount_cents: int,
    currency: str,
    product_name: str,
):
    """Send a receipt email after successful purchase."""
    
    amount_display = f"{currency} {amount_cents / 100:.2f}"
    
    # In a real implementation, this would use a Jinja2 template
    # For now, sending a simple HTML email
    try:
        resend.Emails.send({
            "from": "Practicable <noreply@practicable.com>",
            "to": [to_email],
            "subject": "Your receipt from Practicable",
            "html": f"""
                <h1>Thank you for your purchase</h1>
                <p>Your order #{order_id} has been completed.</p>
                <p><strong>Amount:</strong> {amount_display}</p>
                <p><strong>Product:</strong> {product_name}</p>
                <p>You can access your purchased content in your library.</p>
            """,
        })
    except Exception as e:
        print(f"Failed to send receipt email: {e}")
        # Don't fail the order if email fails - log and continue
