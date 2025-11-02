# Generated manually for ForecastAccuracyHistory model

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('analytics', '0001_initial'),  # Adjust to your latest migration
    ]

    operations = [
        migrations.CreateModel(
            name='ForecastAccuracyHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('forecast_type', models.CharField(
                    choices=[
                        ('sales', 'Ventas Totales'),
                        ('product_demand', 'Demanda de Producto'),
                        ('category_sales', 'Ventas por Categoría'),
                        ('warehouse_inventory', 'Inventario por Bodega'),
                    ],
                    db_index=True,
                    max_length=50
                )),
                ('product_id', models.IntegerField(blank=True, db_index=True, null=True)),
                ('category_id', models.IntegerField(blank=True, null=True)),
                ('warehouse_id', models.IntegerField(blank=True, null=True)),
                ('forecast_date', models.DateField(help_text='Fecha en que se hizo la predicción')),
                ('predicted_date', models.DateField(help_text='Fecha para la cual se predijo')),
                ('forecast_horizon_days', models.IntegerField(help_text='Días de anticipación (predicted_date - forecast_date)')),
                ('predicted_value', models.DecimalField(decimal_places=2, help_text='Valor predicho', max_digits=12)),
                ('actual_value', models.DecimalField(
                    blank=True, 
                    decimal_places=2, 
                    help_text='Valor real (llenado después)', 
                    max_digits=12, 
                    null=True
                )),
                ('confidence_lower', models.DecimalField(
                    blank=True,
                    decimal_places=2,
                    help_text='Límite inferior del intervalo de confianza',
                    max_digits=12,
                    null=True
                )),
                ('confidence_upper', models.DecimalField(
                    blank=True,
                    decimal_places=2,
                    help_text='Límite superior del intervalo de confianza',
                    max_digits=12,
                    null=True
                )),
                ('absolute_error', models.DecimalField(
                    blank=True,
                    decimal_places=2,
                    help_text='|predicted - actual|',
                    max_digits=12,
                    null=True
                )),
                ('percentage_error', models.DecimalField(
                    blank=True,
                    decimal_places=2,
                    help_text='Error porcentual',
                    max_digits=8,
                    null=True
                )),
                ('within_confidence', models.BooleanField(
                    blank=True,
                    help_text='Si el valor real cayó dentro del intervalo de confianza',
                    null=True
                )),
                ('model_name', models.CharField(default='Prophet', max_length=50)),
                ('model_version', models.CharField(blank=True, max_length=50, null=True)),
                ('model_params', models.JSONField(blank=True, default=dict, help_text='Parámetros usados en el modelo')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Historial de Precisión de Forecast',
                'verbose_name_plural': 'Historiales de Precisión de Forecast',
                'db_table': 'analytics_forecast_accuracy_history',
                'ordering': ['-forecast_date', '-predicted_date'],
            },
        ),
        migrations.AddIndex(
            model_name='forecastaccuracyhistory',
            index=models.Index(fields=['forecast_type', '-forecast_date'], name='analytics_f_forecas_idx'),
        ),
        migrations.AddIndex(
            model_name='forecastaccuracyhistory',
            index=models.Index(fields=['product_id', '-predicted_date'], name='analytics_f_product_idx'),
        ),
        migrations.AddIndex(
            model_name='forecastaccuracyhistory',
            index=models.Index(fields=['forecast_horizon_days'], name='analytics_f_horizon_idx'),
        ),
        migrations.AddIndex(
            model_name='forecastaccuracyhistory',
            index=models.Index(fields=['-created_at'], name='analytics_f_created_idx'),
        ),
    ]
