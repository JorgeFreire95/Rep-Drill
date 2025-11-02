/**
 * Hook para validación de calidad de datos
 * Integración con DataQualityValidator backend
 */

import { useState, useCallback } from 'react';

export interface DataQualityReport {
  quality_score: number; // 0-100
  issues: string[];
  total_issues: number;
  missing_dates?: number;
  negative_values?: number;
  duplicates?: number;
  data_gaps?: number;
  outliers?: number;
}

export interface ValidationResult {
  isValid: boolean;
  score: number;
  report: DataQualityReport | null;
  message: string;
}

const QUALITY_THRESHOLDS = {
  excellent: 90,
  good: 70,
  acceptable: 50,
  poor: 0,
};

export const useDataQualityValidator = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DataQualityReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validar datos en el frontend
   */
  const validateData = useCallback(
    (data: (number | null)[], dates?: (Date | null)[]): ValidationResult => {
      setLoading(true);
      setError(null);

      try {
        const issues: string[] = [];
        let missingDates = 0;
        let negativeValues = 0;
        let duplicates = 0;
        let outliers = 0;

        // Validar valores negativos
        data.forEach((value, index) => {
          if (value === null) return;
          if (value < 0) {
            negativeValues++;
            issues.push(`Valor negativo en posición ${index}: ${value}`);
          }
        });

        // Validar duplicados
        const valueMap = new Map<number, number>();
        data.forEach((value) => {
          if (value === null) return;
          valueMap.set(value, (valueMap.get(value) || 0) + 1);
        });
        valueMap.forEach((count, value) => {
          if (count > 1) {
            duplicates++;
            issues.push(`Valor duplicado: ${value} (${count} veces)`);
          }
        });

        // Validar fechas faltantes
        if (dates) {
          dates.forEach((date, index) => {
            if (date === null) {
              missingDates++;
              issues.push(`Fecha faltante en posición ${index}`);
            }
          });

          // Validar gaps en fechas
          const dataDiffs: number[] = [];
          for (let i = 1; i < dates.length; i++) {
            const currDate = dates[i];
            const prevDate = dates[i - 1];
            if (currDate && prevDate) {
              const diff = Math.abs(
                new Date(currDate).getTime() - new Date(prevDate).getTime()
              );
              dataDiffs.push(diff);
            }
          }

          // Detectar gaps (diferencias > 2 días)
          const avgDiff = dataDiffs.reduce((a, b) => a + b, 0) / dataDiffs.length;
          dataDiffs.forEach((diff, index) => {
            if (diff > avgDiff * 2) {
              issues.push(`Gap de datos detectado entre índice ${index} y ${index + 1}`);
            }
          });
        }

        // Detectar outliers usando IQR
        const sortedData = [...data]
          .filter((v) => v !== null)
          .sort((a, b) => (a ?? 0) - (b ?? 0)) as number[];

        if (sortedData.length > 4) {
          const q1Index = Math.floor(sortedData.length * 0.25);
          const q3Index = Math.floor(sortedData.length * 0.75);
          const q1 = sortedData[q1Index];
          const q3 = sortedData[q3Index];
          const iqr = q3 - q1;
          const lowerBound = q1 - 1.5 * iqr;
          const upperBound = q3 + 1.5 * iqr;

          data.forEach((value, index) => {
            if (value === null) return;
            if (value < lowerBound || value > upperBound) {
              outliers++;
              issues.push(`Outlier detectado en posición ${index}: ${value}`);
            }
          });
        }

        // Calcular score
        const totalIssues = issues.length;
        const qualityScore = Math.max(0, 100 - totalIssues * 5);

        const validationReport: DataQualityReport = {
          quality_score: qualityScore,
          issues,
          total_issues: totalIssues,
          missing_dates: missingDates,
          negative_values: negativeValues,
          duplicates,
          outliers,
        };

        setReport(validationReport);

        const result: ValidationResult = {
          isValid: qualityScore >= QUALITY_THRESHOLDS.acceptable,
          score: qualityScore,
          report: validationReport,
          message: getQualityMessage(qualityScore),
        };

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
        setError(errorMsg);
        return {
          isValid: false,
          score: 0,
          report: null,
          message: `Error: ${errorMsg}`,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Obtener mensaje de calidad
   */
  const getQualityMessage = (score: number): string => {
    if (score >= QUALITY_THRESHOLDS.excellent) {
      return 'Excelente calidad de datos ✅';
    } else if (score >= QUALITY_THRESHOLDS.good) {
      return 'Buena calidad de datos ✓';
    } else if (score >= QUALITY_THRESHOLDS.acceptable) {
      return 'Calidad aceptable (revisar)';
    } else {
      return 'Mala calidad de datos (no recomendado) ⚠️';
    }
  };

  /**
   * Obtener color según score
   */
  const getQualityColor = (score: number): string => {
    if (score >= QUALITY_THRESHOLDS.excellent) return '#10b981'; // Green
    if (score >= QUALITY_THRESHOLDS.good) return '#3b82f6'; // Blue
    if (score >= QUALITY_THRESHOLDS.acceptable) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  /**
   * Obtener badge de calidad
   */
  const getQualityBadge = (score: number): string => {
    if (score >= QUALITY_THRESHOLDS.excellent) return 'Excellent';
    if (score >= QUALITY_THRESHOLDS.good) return 'Good';
    if (score >= QUALITY_THRESHOLDS.acceptable) return 'Acceptable';
    return 'Poor';
  };

  return {
    validateData,
    report,
    loading,
    error,
    getQualityMessage,
    getQualityColor,
    getQualityBadge,
    QUALITY_THRESHOLDS,
  };
};
