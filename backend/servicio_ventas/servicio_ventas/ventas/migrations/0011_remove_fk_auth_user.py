# Generated migration to fix auth_user dependency issue
# This replaces ForeignKeys to settings.AUTH_USER_MODEL with IntegerField to store user IDs

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0009_servicehealthcheck'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='confirmed_at',
            field=models.DateTimeField(blank=True, help_text='Fecha cuando se confirmó la orden', null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='confirmed_by_id',
            field=models.IntegerField(blank=True, help_text='ID del empleado que confirmó la orden', null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='created_by_id',
            field=models.IntegerField(blank=True, help_text='ID del empleado que creó la orden', null=True),
        ),
    ]
