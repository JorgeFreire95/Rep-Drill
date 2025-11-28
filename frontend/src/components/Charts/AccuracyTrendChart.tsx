import React, { useState, useEffect } from 'react';
import { Card, Spin, message, DatePicker, Space, Radio } from 'antd';
import { Line } from '@ant-design/charts';
import { analyticsService } from '../../services/analyticsService';
import type { ForecastProductAccuracy } from '../../types';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

interface AccuracyTrendChartProps {
  productId?: number;
  categoryId?: number;
  title?: string;
}

/**
 * Gráfico de Tendencia de Precisión
 * Muestra evolución temporal de métricas MAPE y MAE
 */
export const AccuracyTrendChart: React.FC<AccuracyTrendChartProps> = ({
  productId,
  categoryId,
  title = 'Tendencia de Precisión en el Tiempo',
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [metricType, setMetricType] = useState<'mape' | 'mae'>('mape');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(3, 'month'),
    dayjs(),
  ]);

  useEffect(() => {
    loadTrendData();
  }, [productId, categoryId, dateRange, metricType]);

  const loadTrendData = async () => {
    setLoading(true);
    try {
      const params: any = {
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
      };

      if (productId) {
        params.product_id = productId;
      }
      if (categoryId) {
        params.category_id = categoryId;
      }

      const response = await analyticsService.getForecastProductAccuracy(params);
      const accuracyData = Array.isArray(response) ? response : response.results || [];

      // Transform data for chart
      const transformedData = accuracyData.flatMap((item: ForecastProductAccuracy) => {
        // Normalizar valores numéricos
        const mapeValue = typeof item.mape === 'number' ? item.mape : parseFloat(item.mape) || 0;
        const maeValue = typeof item.mae === 'number' ? item.mae : parseFloat(item.mae) || 0;
        
        return [{
          date: item.end_date,
          value: metricType === 'mape' ? mapeValue : maeValue,
          type: metricType.toUpperCase(),
          name: item.product_name,
        }];
      });

      // Sort by date
      transformedData.sort((a: { date: string | Date }, b: { date: string | Date }) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setData(transformedData);
    } catch (error) {
      console.error('Error loading trend data:', error);
      message.error('Error al cargar datos de tendencia');
    } finally {
      setLoading(false);
    }
  };

  const config = {
    data,
    xField: 'date',
    yField: 'value',
    seriesField: 'name',
    smooth: true,
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000,
      },
    },
    point: {
      size: 4,
      shape: 'circle',
      style: {
        fillOpacity: 0.7,
        strokeOpacity: 0.7,
      },
    },
    legend: {
      position: 'top' as const,
    },
    xAxis: {
      type: 'time',
      label: {
        formatter: (v: string) => dayjs(v).format('DD/MM/YY'),
      },
    },
    yAxis: {
      label: {
        formatter: (v: string) => {
          const numValue = parseFloat(v);
          if (isNaN(numValue)) return '0';
          return metricType === 'mape' ? `${numValue.toFixed(1)}%` : numValue.toFixed(1);
        },
      },
      min: 0,
    },
    tooltip: {
      formatter: (datum: any) => {
        const numValue = typeof datum.value === 'number' ? datum.value : parseFloat(datum.value) || 0;
        return {
          name: datum.name,
          value: metricType === 'mape' 
            ? `${numValue.toFixed(2)}%` 
            : numValue.toFixed(2),
        };
      },
    },
    color: metricType === 'mape' 
      ? ['#1890ff', '#52c41a', '#faad14', '#ff4d4f']
      : ['#722ed1', '#eb2f96', '#13c2c2', '#fa8c16'],
  };

  return (
    <Card
      title={title}
      extra={
        <Space>
          <Radio.Group 
            value={metricType} 
            onChange={(e) => setMetricType(e.target.value)}
            size="small"
          >
            <Radio.Button value="mape">MAPE</Radio.Button>
            <Radio.Button value="mae">MAE</Radio.Button>
          </Radio.Group>
          <RangePicker
            value={dateRange}
            onChange={(dates) => dates && setDateRange(dates as [Dayjs, Dayjs])}
            size="small"
            format="DD/MM/YYYY"
            maxDate={dayjs()}
          />
        </Space>
      }
    >
      <Spin spinning={loading}>
        {data.length > 0 ? (
          <Line {...config} height={350} />
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: '50px 0', 
            color: '#8c8c8c' 
          }}>
            No hay datos disponibles para el periodo seleccionado
          </div>
        )}
      </Spin>
    </Card>
  );
};

export default AccuracyTrendChart;
