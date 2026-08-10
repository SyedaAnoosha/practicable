"""Initial schema: users, sections, authors, domains, tag_values, questions, courses, modules, lessons, templates, media, products, orders, entitlements, progress, leads, audit, webhooks

Revision ID: 001
Revises: 
Create Date: 2024-08-10 14:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum types
    role_enum = postgresql.ENUM('member', 'admin', name='role', create_type=False)
    role_enum.create(op.get_bind())
    
    lesson_type_enum = postgresql.ENUM('video', 'reading', 'download', 'mixed', name='lesson_type', create_type=False)
    lesson_type_enum.create(op.get_bind())
    
    media_status_enum = postgresql.ENUM('uploading', 'ready', 'error', name='media_status', create_type=False)
    media_status_enum.create(op.get_bind())
    
    order_status_enum = postgresql.ENUM('pending', 'completed', 'failed', 'refunded', name='order_status', create_type=False)
    order_status_enum.create(op.get_bind())
    
    granted_via_enum = postgresql.ENUM('purchase', 'manual', 'free', name='granted_via', create_type=False)
    granted_via_enum.create(op.get_bind())
    
    # Create tables
    op.create_table('users',
        # id has no server_default: it must be set explicitly to the Supabase auth
        # user id on insert (app/core/deps.py get_current_user) — see app/db/models/user.py.
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('role', role_enum, nullable=False, server_default='member'),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('sections',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('description', sa.String(length=1000), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )
    
    op.create_table('authors',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('bio', sa.String(length=2000), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )
    
    op.create_table('domains',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('description', sa.String(length=1000), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
        sa.UniqueConstraint('slug')
    )
    
    op.create_table('tag_values',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('tag_dimension', sa.String(length=50), nullable=False),
        sa.Column('value', sa.String(length=100), nullable=False),
        sa.Column('display_label', sa.String(length=255), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('ix_tag_values_dimension', 'tag_values', ['tag_dimension'])
    
    op.create_table('questions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('subtitle', sa.String(length=500), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('preview', sa.String(length=160), nullable=False),
        sa.Column('domain_id', sa.UUID(), nullable=False),
        sa.Column('effort_tag_id', sa.UUID(), nullable=True),
        sa.Column('duration_tag_id', sa.UUID(), nullable=True),
        sa.Column('cost_tag_id', sa.UUID(), nullable=True),
        sa.Column('roi_horizon_tag_id', sa.UUID(), nullable=True),
        sa.Column('tier_tag_id', sa.UUID(), nullable=True),
        sa.Column('regulator_pressure_tag_id', sa.UUID(), nullable=True),
        sa.Column('published', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['domain_id'], ['domains.id'], ),
        sa.ForeignKeyConstraint(['effort_tag_id'], ['tag_values.id'], ),
        sa.ForeignKeyConstraint(['duration_tag_id'], ['tag_values.id'], ),
        sa.ForeignKeyConstraint(['cost_tag_id'], ['tag_values.id'], ),
        sa.ForeignKeyConstraint(['roi_horizon_tag_id'], ['tag_values.id'], ),
        sa.ForeignKeyConstraint(['tier_tag_id'], ['tag_values.id'], ),
        sa.ForeignKeyConstraint(['regulator_pressure_tag_id'], ['tag_values.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )
    
    op.create_table('question_leadership_traits',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('question_id', sa.UUID(), nullable=False),
        sa.Column('trait_tag_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ),
        sa.ForeignKeyConstraint(['trait_tag_id'], ['tag_values.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('question_relations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('question_id', sa.UUID(), nullable=False),
        sa.Column('related_question_id', sa.UUID(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ),
        sa.ForeignKeyConstraint(['related_question_id'], ['questions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('courses',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('subtitle', sa.String(length=500), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('section_id', sa.UUID(), nullable=False),
        sa.Column('author_id', sa.UUID(), nullable=False),
        sa.Column('published', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['author_id'], ['authors.id'], ),
        sa.ForeignKeyConstraint(['section_id'], ['sections.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )
    
    op.create_table('modules',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('course_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('lessons',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('lesson_type', lesson_type_enum, nullable=False, server_default='video'),
        sa.Column('module_id', sa.UUID(), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('published', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['module_id'], ['modules.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )
    
    op.create_table('media',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('lesson_id', sa.UUID(), nullable=False),
        sa.Column('mux_asset_id', sa.String(length=255), nullable=True),
        sa.Column('mux_playback_id', sa.String(length=255), nullable=True),
        sa.Column('status', media_status_enum, nullable=False, server_default='uploading'),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('templates',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('section_id', sa.UUID(), nullable=False),
        sa.Column('author_id', sa.UUID(), nullable=False),
        sa.Column('storage_key', sa.String(length=500), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('published', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['author_id'], ['authors.id'], ),
        sa.ForeignKeyConstraint(['section_id'], ['sections.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )

    op.create_table('question_templates',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('question_id', sa.UUID(), nullable=False),
        sa.Column('template_id', sa.UUID(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ),
        sa.ForeignKeyConstraint(['template_id'], ['templates.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('question_lessons',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('question_id', sa.UUID(), nullable=False),
        sa.Column('lesson_id', sa.UUID(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ),
        sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('products',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=500), nullable=False),
        sa.Column('description', sa.String(length=2000), nullable=False),
        sa.Column('stripe_price_id', sa.String(length=255), nullable=False),
        sa.Column('price_amount', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='AUD'),
        sa.Column('published', sa.Boolean(), nullable=False, server_default='false'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )
    
    op.create_table('product_contents',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('product_id', sa.UUID(), nullable=False),
        sa.Column('content_type', sa.String(length=50), nullable=False),
        sa.Column('content_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('orders',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('stripe_session_id', sa.String(length=255), nullable=False),
        sa.Column('stripe_payment_intent_id', sa.String(length=255), nullable=True),
        sa.Column('status', order_status_enum, nullable=False, server_default='pending'),
        sa.Column('total_amount_cents', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('order_items',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('order_id', sa.UUID(), nullable=False),
        sa.Column('product_id', sa.UUID(), nullable=False),
        sa.Column('price_amount_cents', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('entitlements',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('product_id', sa.UUID(), nullable=False),
        sa.Column('granted_via', granted_via_enum, nullable=False, server_default='purchase'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('lesson_progress',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('lesson_id', sa.UUID(), nullable=False),
        sa.Column('completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resume_at_seconds', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('course_progress',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('course_id', sa.UUID(), nullable=False),
        sa.Column('completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('percentage_complete', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('leads',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('source', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('audit_log',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('actor_user_id', sa.UUID(), nullable=True),
        sa.Column('action', sa.String(length=255), nullable=False),
        sa.Column('target_type', sa.String(length=100), nullable=False),
        sa.Column('target_id', sa.UUID(), nullable=False),
        sa.Column('context', sa.String(length=2000), nullable=True),
        sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('webhook_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('stripe_event_id', sa.String(length=255), nullable=False),
        sa.Column('event_type', sa.String(length=255), nullable=False),
        sa.Column('processed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('error_message', sa.String(length=1000), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('stripe_event_id')
    )


def downgrade() -> None:
    op.drop_table('webhook_events')
    op.drop_table('audit_log')
    op.drop_table('leads')
    op.drop_table('course_progress')
    op.drop_table('lesson_progress')
    op.drop_table('entitlements')
    op.drop_table('order_items')
    op.drop_table('orders')
    op.drop_table('product_contents')
    op.drop_table('products')
    op.drop_table('question_lessons')
    op.drop_table('question_templates')
    op.drop_table('templates')
    op.drop_table('media')
    op.drop_table('lessons')
    op.drop_table('modules')
    op.drop_table('courses')
    op.drop_table('question_relations')
    op.drop_table('question_leadership_traits')
    op.drop_table('questions')
    op.drop_index('ix_tag_values_dimension', table_name='tag_values')
    op.drop_table('tag_values')
    op.drop_table('domains')
    op.drop_table('authors')
    op.drop_table('sections')
    op.drop_table('users')
    
    postgresql.ENUM(name='granted_via').drop(op.get_bind())
    postgresql.ENUM(name='order_status').drop(op.get_bind())
    postgresql.ENUM(name='media_status').drop(op.get_bind())
    postgresql.ENUM(name='lesson_type').drop(op.get_bind())
    postgresql.ENUM(name='role').drop(op.get_bind())
