import sqlalchemy as sa
from alembic import op

revision = "040"
down_revision = "039"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("promotions", sa.Column("first_time_transaction", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("promotions", sa.Column("minimum_amount", sa.Integer(), nullable=True))
    op.add_column("promotions", sa.Column("max_redemptions", sa.Integer(), nullable=True))

def downgrade() -> None:
    op.drop_column("promotions", "max_redemptions")
    op.drop_column("promotions", "minimum_amount")
    op.drop_column("promotions", "first_time_transaction")
