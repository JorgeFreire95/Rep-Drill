"""
Validador de calidad de datos.
Verifica que los datos cumplan con estándares antes de usarlos en modelos predictivos.
"""

import pandas as pd
import numpy as np
import logging
from typing import Dict, List, Any, Tuple
from decimal import Decimal

logger = logging.getLogger(__name__)


class DataQualityIssue:
    """Representa un problema de calidad de datos."""
    
    def __init__(
        self,
        issue_type: str,
        severity: str,
        description: str,
        affected_records: List[Any] = None
    ):
        """
        Args:
            issue_type: Tipo de issue (missing_dates, negative_values, etc)
            severity: 'info', 'warning', 'error'
            description: Descripción del problema
            affected_records: Registros afectados
        """
        self.issue_type = issue_type
        self.severity = severity
        self.description = description
        self.affected_records = affected_records or []
    
    def to_dict(self) -> Dict:
        """Convertir a diccionario."""
        return {
            'type': self.issue_type,
            'severity': self.severity,
            'description': self.description,
            'count': len(self.affected_records),
            'examples': self.affected_records[:5]  # Primeros 5 ejemplos
        }


class DataQualityReport:
    """Reporte de calidad de datos."""
    
    def __init__(self):
        self.issues: List[DataQualityIssue] = []
        self.quality_score = 100
        self.is_valid = True
    
    def add_issue(self, issue: DataQualityIssue):
        """Agregar issue al reporte."""
        self.issues.append(issue)
        
        # Ajustar score y validez
        if issue.severity == 'error':
            self.is_valid = False
            self.quality_score = max(0, self.quality_score - 20)
        elif issue.severity == 'warning':
            self.quality_score = max(0, self.quality_score - 5)
        else:
            self.quality_score = max(0, self.quality_score - 1)
    
    def to_dict(self) -> Dict:
        """Convertir a diccionario."""
        return {
            'is_valid': self.is_valid,
            'quality_score': self.quality_score,
            'issues_count': len(self.issues),
            'issues': [issue.to_dict() for issue in self.issues],
            'summary': self._generate_summary()
        }
    
    def _generate_summary(self) -> str:
        """Generar resumen del reporte."""
        if self.is_valid:
            return f"Datos válidos con score {self.quality_score}%"
        else:
            error_count = sum(1 for i in self.issues if i.severity == 'error')
            return f"Datos INVÁLIDOS: {error_count} errores críticos"


class DataQualityValidator:
    """
    Validador de calidad de datos para análisis y predicciones.
    
    Validaciones:
    - Fechas faltantes
    - Valores negativos o inválidos
    - Outliers
    - Duplicados
    - Gaps de datos
    - Valores NULL
    - Rango de valores
    """
    
    # Umbrales
    OUTLIER_IQR_MULTIPLIER = 3  # Detectar outliers > 3*IQR
    MAX_MISSING_PERCENT = 10    # Máximo 10% de datos faltantes
    
    @staticmethod
    def validate_daily_metrics(df: pd.DataFrame) -> DataQualityReport:
        """
        Validar métricas diarias de ventas.
        
        Args:
            df: DataFrame con columnas: ds (fecha), y (ventas)
        
        Returns:
            DataQualityReport
        """
        report = DataQualityReport()
        
        if df is None or len(df) == 0:
            issue = DataQualityIssue(
                'empty_data',
                'error',
                'DataFrame está vacío',
            )
            report.add_issue(issue)
            return report
        
        # Asegurar tipos correctos
        try:
            df = df.copy()
            df['ds'] = pd.to_datetime(df['ds'])
            df['y'] = pd.to_numeric(df['y'])
        except Exception as e:
            issue = DataQualityIssue(
                'type_conversion',
                'error',
                f'Error convertiendo tipos: {e}',
            )
            report.add_issue(issue)
            return report
        
        # 1. Validar cantidad mínima de datos
        if len(df) < 30:
            issue = DataQualityIssue(
                'insufficient_data',
                'error',
                f'Solo {len(df)} registros (mínimo 30 requeridos)',
            )
            report.add_issue(issue)
        
        # 2. Validar fechas faltantes
        report = DataQualityValidator._check_missing_dates(df, report)
        
        # 3. Validar valores negativos
        report = DataQualityValidator._check_negative_values(df, report)
        
        # 4. Validar NULL/NaN
        report = DataQualityValidator._check_null_values(df, report)
        
        # 5. Validar outliers
        report = DataQualityValidator._check_outliers(df, report)
        
        # 6. Validar duplicados
        report = DataQualityValidator._check_duplicates(df, report)
        
        # 7. Validar gaps de tiempo
        report = DataQualityValidator._check_time_gaps(df, report)
        
        # 8. Validar rango de valores razonable
        report = DataQualityValidator._check_value_range(df, report)
        
        logger.info(f"Data quality validation: {report.to_dict()}")
        
        return report
    
    @staticmethod
    def _check_missing_dates(df: pd.DataFrame, report: DataQualityReport) -> DataQualityReport:
        """Detectar fechas faltantes en la serie."""
        try:
            date_range = pd.date_range(
                df['ds'].min(),
                df['ds'].max(),
                freq='D'
            )
            missing_dates = date_range[~date_range.isin(df['ds'])]
            
            if len(missing_dates) > 0:
                missing_percent = (len(missing_dates) / len(date_range)) * 100
                severity = 'error' if missing_percent > 30 else 'warning'
                
                issue = DataQualityIssue(
                    'missing_dates',
                    severity,
                    f'{len(missing_dates)} fechas faltantes ({missing_percent:.1f}%)',
                    missing_dates.strftime('%Y-%m-%d').tolist()
                )
                report.add_issue(issue)
        except Exception as e:
            logger.error(f"Error en check_missing_dates: {e}")
        
        return report
    
    @staticmethod
    def _check_negative_values(df: pd.DataFrame, report: DataQualityReport) -> DataQualityReport:
        """Detectar valores negativos (imposibles en ventas)."""
        negative_mask = df['y'] < 0
        negative_records = df[negative_mask]
        
        if len(negative_records) > 0:
            issue = DataQualityIssue(
                'negative_values',
                'error',
                f'{len(negative_records)} registros con valores negativos',
                negative_records['ds'].dt.strftime('%Y-%m-%d').tolist()
            )
            report.add_issue(issue)
        
        return report
    
    @staticmethod
    def _check_null_values(df: pd.DataFrame, report: DataQualityReport) -> DataQualityReport:
        """Detectar valores NULL/NaN."""
        null_mask = df['y'].isna()
        null_records = df[null_mask]
        
        if len(null_records) > 0:
            null_percent = (len(null_records) / len(df)) * 100
            severity = 'error' if null_percent > 10 else 'warning'
            
            issue = DataQualityIssue(
                'null_values',
                severity,
                f'{len(null_records)} valores NULL ({null_percent:.1f}%)',
                null_records['ds'].dt.strftime('%Y-%m-%d').tolist()
            )
            report.add_issue(issue)
        
        return report
    
    @staticmethod
    def _check_outliers(df: pd.DataFrame, report: DataQualityReport) -> DataQualityReport:
        """Detectar outliers usando IQR."""
        try:
            Q1 = df['y'].quantile(0.25)
            Q3 = df['y'].quantile(0.75)
            IQR = Q3 - Q1
            
            lower_bound = Q1 - (DataQualityValidator.OUTLIER_IQR_MULTIPLIER * IQR)
            upper_bound = Q3 + (DataQualityValidator.OUTLIER_IQR_MULTIPLIER * IQR)
            
            outlier_mask = (df['y'] < lower_bound) | (df['y'] > upper_bound)
            outlier_records = df[outlier_mask]
            
            if len(outlier_records) > 0:
                outlier_percent = (len(outlier_records) / len(df)) * 100
                
                issue = DataQualityIssue(
                    'outliers',
                    'warning',
                    f'{len(outlier_records)} outliers detectados ({outlier_percent:.1f}%)',
                    [
                        f"{row['ds'].date()}: {row['y']}"
                        for _, row in outlier_records.iterrows()
                    ]
                )
                report.add_issue(issue)
        except Exception as e:
            logger.error(f"Error en check_outliers: {e}")
        
        return report
    
    @staticmethod
    def _check_duplicates(df: pd.DataFrame, report: DataQualityReport) -> DataQualityReport:
        """Detectar fechas duplicadas."""
        duplicate_mask = df.duplicated(subset=['ds'], keep=False)
        duplicate_records = df[duplicate_mask]
        
        if len(duplicate_records) > 0:
            issue = DataQualityIssue(
                'duplicates',
                'error',
                f'{len(duplicate_records)} registros duplicados por fecha',
                duplicate_records['ds'].dt.strftime('%Y-%m-%d').tolist()
            )
            report.add_issue(issue)
        
        return report
    
    @staticmethod
    def _check_time_gaps(df: pd.DataFrame, report: DataQualityReport) -> DataQualityReport:
        """Detectar gaps significativos en la serie temporal."""
        try:
            df_sorted = df.sort_values('ds')
            gaps = df_sorted['ds'].diff()
            
            # Buscar gaps > 2 días
            large_gap_mask = gaps > pd.Timedelta('2D')
            large_gaps = gaps[large_gap_mask]
            
            if len(large_gaps) > 0:
                # Convertir a días de forma segura incluso si el tipo es numpy.timedelta64
                examples = []
                try:
                    for gap in large_gaps.values[:5]:
                        # gap puede ser pandas.Timedelta o numpy.timedelta64
                        try:
                            # pandas.Timedelta
                            days_val = int(getattr(gap, 'days', None) if hasattr(gap, 'days') else None)
                            if days_val is None:
                                raise AttributeError
                        except Exception:
                            # numpy.timedelta64 -> días
                            days_val = int((gap / np.timedelta64(1, 'D')).astype('int64'))
                        examples.append(f"{days_val} días")
                except Exception:
                    # Fallback: usar representación de string
                    examples = [str(g) for g in large_gaps.values[:5]]

                issue = DataQualityIssue(
                    'data_gaps',
                    'warning',
                    f'{len(large_gaps)} gaps > 2 días detectados',
                    examples
                )
                report.add_issue(issue)
        except Exception as e:
            logger.error(f"Error en check_time_gaps: {e}")
        
        return report
    
    @staticmethod
    def _check_value_range(df: pd.DataFrame, report: DataQualityReport) -> DataQualityReport:
        """Validar que los valores están en rango razonable."""
        try:
            # Rango razonable para ventas diarias: 0 a 999,999,999
            max_reasonable = Decimal('999999999')
            
            if df['y'].max() > max_reasonable:
                issue = DataQualityIssue(
                    'unreasonable_value',
                    'warning',
                    f'Valor muy alto detectado: {df["y"].max():,.0f}',
                )
                report.add_issue(issue)
            
            if df['y'].min() < 0:
                issue = DataQualityIssue(
                    'negative_range',
                    'error',
                    f'Valores negativos: min={df["y"].min():,.0f}',
                )
                report.add_issue(issue)
        except Exception as e:
            logger.error(f"Error en check_value_range: {e}")
        
        return report
    
    @staticmethod
    def get_data_summary(df: pd.DataFrame) -> Dict[str, Any]:
        """Obtener resumen estadístico de los datos."""
        try:
            return {
                'total_records': len(df),
                'date_range': {
                    'start': df['ds'].min().isoformat(),
                    'end': df['ds'].max().isoformat(),
                    'days': (df['ds'].max() - df['ds'].min()).days
                },
                'sales_stats': {
                    'min': float(df['y'].min()),
                    'max': float(df['y'].max()),
                    'mean': float(df['y'].mean()),
                    'std': float(df['y'].std()),
                    'median': float(df['y'].median()),
                }
            }
        except Exception as e:
            logger.error(f"Error en get_data_summary: {e}")
            return {}
