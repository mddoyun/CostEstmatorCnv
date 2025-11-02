# Generated manually on 2025-11-02
# Custom migration to handle ManyToMany through model conversion

import django.db.models.deletion
import uuid
from django.db import migrations, models


def migrate_existing_classifications(apps, schema_editor):
    """
    기존 classification_tags 관계를 ElementClassificationAssignment로 마이그레이션합니다.
    모든 기존 할당은 'manual' 타입으로 처리됩니다.
    """
    RawElement = apps.get_model('connections', 'RawElement')
    ElementClassificationAssignment = apps.get_model('connections', 'ElementClassificationAssignment')

    # Get the through model for the old M2M relationship
    db_alias = schema_editor.connection.alias

    # Copy all existing relationships to the new through table
    # Note: We need to access the old M2M table directly
    with schema_editor.connection.cursor() as cursor:
        # Check if the old M2M table exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='connections_rawelement_classification_tags'
        """)

        if cursor.fetchone():
            # Copy data from old M2M table to new through table
            cursor.execute("""
                INSERT INTO connections_elementclassificationassignment
                    (id, raw_element_id, classification_tag_id, assignment_type, assigned_by_rule_id, assigned_at)
                SELECT
                    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
                          substr(hex(randomblob(2)), 2) || '-' ||
                          substr('89ab', abs(random()) % 4 + 1, 1) ||
                          substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
                    rawelement_id,
                    quantityclassificationtag_id,
                    'manual',
                    NULL,
                    datetime('now')
                FROM connections_rawelement_classification_tags
            """)


def reverse_migrate_classifications(apps, schema_editor):
    """
    Reverse migration: Copy data back from ElementClassificationAssignment to M2M table
    """
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO connections_rawelement_classification_tags
                (rawelement_id, quantityclassificationtag_id)
            SELECT DISTINCT raw_element_id, classification_tag_id
            FROM connections_elementclassificationassignment
        """)


class Migration(migrations.Migration):

    dependencies = [
        ('connections', '0013_activityassignmentrule'),
    ]

    operations = [
        # Step 1: Remove priority field from ClassificationRule
        migrations.AlterModelOptions(
            name='classificationrule',
            options={'ordering': ['id']},
        ),
        migrations.RemoveField(
            model_name='classificationrule',
            name='priority',
        ),

        # Step 2: Create the new ElementClassificationAssignment model
        migrations.CreateModel(
            name='ElementClassificationAssignment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('assignment_type', models.CharField(choices=[('ruleset', '룰셋 기반'), ('manual', '수동')], default='manual', max_length=10)),
                ('assigned_at', models.DateTimeField(auto_now_add=True)),
                ('assigned_by_rule', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='assignments', to='connections.classificationrule')),
                ('classification_tag', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='element_assignments', to='connections.quantityclassificationtag')),
                ('raw_element', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tag_assignments', to='connections.rawelement')),
            ],
            options={
                'ordering': ['-assigned_at'],
                'unique_together': {('raw_element', 'classification_tag')},
            },
        ),

        # Step 3: Migrate existing data
        migrations.RunPython(migrate_existing_classifications, reverse_migrate_classifications),

        # Step 4: Remove the old M2M field
        migrations.RemoveField(
            model_name='rawelement',
            name='classification_tags',
        ),

        # Step 5: Add the new M2M field with through parameter
        migrations.AddField(
            model_name='rawelement',
            name='classification_tags',
            field=models.ManyToManyField(blank=True, related_name='raw_elements', through='connections.ElementClassificationAssignment', to='connections.quantityclassificationtag'),
        ),
    ]
