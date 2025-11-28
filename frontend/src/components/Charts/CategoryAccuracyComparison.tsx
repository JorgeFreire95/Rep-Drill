import React, { useState, useEffect } from 'react';
import { Card, Spin, message, Select, Space, Row, Col, Statistic, Tag } from 'antd';
import { Column } from '@ant-design/charts';
import { TrophyOutlined, WarningOutlined } from '@ant-design/icons';
import { analyticsService } from '../../services/analyticsService';
import type { ForecastCategoryAccuracy } from '../../types';

const { Option } = Select;

interface CategoryAccuracyComparisonProps {
  title?: string;
  showTopN?: number;
}

/**
 * Comparación de Precisión por Categoría
 * Gráfico de barras comparando MAPE y MAE entre categorías
 */
export const CategoryAccuracyComparison: React.FC<CategoryAccuracyComparisonProps> = ({
  title = 'Comparación de Precisión por Categoría',
  showTopN = 10,
}) => {
  const [data, setData] = useState<ForecastCategoryAccuracy[]>([]);
  const [loading, setLoading] = useState(false);
  const [metricType, setMetricType] = useState<'mape' | 'mae'>('mape');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadComparisonData();
  }, []);

  const loadComparisonData = async () => {
    setLoading(true);
    try {
      const response = await analyticsService.getForecastCategoryAccuracy();
      const categories = Array.isArray(response) ? response : response.results || [];
      
      // Normalizar datos: asegurar que mape y mae son números
      const normalizedData = categories.map((cat: any) => ({
        ...cat,
        mape: typeof cat.mape === 'number' ? cat.mape : parseFloat(cat.mape) || 0,
        mae: typeof cat.mae === 'number' ? cat.mae : parseFloat(cat.mae) || 0,
        product_count: typeof cat.product_count === 'number' ? cat.product_count : parseInt(cat.product_count) || 0,
        record_count: typeof cat.record_count === 'number' ? cat.record_count : parseInt(cat.record_count) || 0,
      }));
      
      setData(normalizedData);
    } catch (error) {
      console.error('Error loading category comparison:', error);
      message.error('Error al cargar comparación de categorías');
    } finally {
      setLoading(false);
    }
  };

  const getMapeColor = (mape: number): string => {
    if (mape < 10) return '#52c41a'; // Excelente
    if (mape < 20) return '#1890ff'; // Bueno
    if (mape < 50) return '#faad14'; // Aceptable
    return '#ff4d4f'; // Pobre
  };

  // Sort and filter data
  const processedData = [...data]
    .sort((a, b) => {
      const valueA = a[metricType];
      const valueB = b[metricType];
      return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
    })
    .slice(0, showTopN)
    .map(item => ({
      category: item.category_name,
      value: item[metricType],
      mae: item.mae,
      mape: item.mape,
      productCount: item.product_count,
      recordCount: item.record_count,
      color: getMapeColor(item.mape),
    }));

  // Calculate summary
  const bestCategory = processedData.length > 0 ? processedData[0] : null;
  const worstCategory = processedData.length > 0 ? processedData[processedData.length - 1] : null;
  const avgValue = processedData.length > 0
    ? processedData.reduce((sum, item) => sum + item.value, 0) / processedData.length
    : 0;

  const config = {
    data: processedData,
    xField: 'category',
    yField: 'value',
    seriesField: 'category',
    color: ({ category }: any) => {
      const item = processedData.find(d => d.category === category);
      return item?.color || '#1890ff';
    },
    label: {
      position: 'top' as const,
      style: {
        fill: '#000',
        opacity: 0.6,
      },
      formatter: ({ value }: any) => {
        const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
        return metricType === 'mape' ? `${numValue.toFixed(1)}%` : numValue.toFixed(1);
      },
    },
    xAxis: {
      label: {
        autoRotate: true,
        autoHide: true,
        style: {
          fontSize: 11,
        },
      },
    },
    yAxis: {
      label: {
        formatter: (v: string) => {
          const numValue = parseFloat(v);
          if (isNaN(numValue)) return '0';
          return metricType === 'mape' ? `${numValue.toFixed(0)}%` : numValue.toFixed(0);
        },
      },
      min: 0,
    },
    tooltip: {
      formatter: (datum: any) => {
        const item = processedData.find(d => d.category === datum.category);
        const numValue = typeof datum.value === 'number' ? datum.value : parseFloat(datum.value) || 0;
        const numMape = item && typeof item.mape === 'number' ? item.mape : (item && typeof item.mape === 'string' ? parseFloat(item.mape) : 0) || 0;
        const numMae = item && typeof item.mae === 'number' ? item.mae : (item && typeof item.mae === 'string' ? parseFloat(item.mae) : 0) || 0;
        const productCount = item && typeof item.productCount === 'number' ? item.productCount : 0;
        const recordCount = item && typeof item.recordCount === 'number' ? item.recordCount : 0;
        return {
          name: datum.category,
          value: metricType === 'mape' 
            ? `${numValue.toFixed(2)}%` 
            : numValue.toFixed(2),
          mape: `${numMape.toFixed(2)}%`,
          mae: numMae.toFixed(2),
          products: `${productCount} productos`,
          records: `${recordCount} registros`,
        };
      },
      customContent: (_title: string, items: any[]) => {
        if (!items || items.length === 0) return '';
        const item = items[0];
        return `
          <div style="padding: 12px;">
            <div style="font-weight: 500; margin-bottom: 8px;">${item.data.name}</div>
            <div>MAPE: <strong>${item.data.mape}</strong></div>
            <div>MAE: <strong>${item.data.mae}</strong></div>
            <div>${item.data.products}</div>
            <div>${item.data.records}</div>
          </div>
        `;
      },
    },
    columnStyle: {
      radius: [8, 8, 0, 0],
    },
    legend: false,
  };

  return (
    <Card
      title={title}
      extra={
        <Space>
          <Select
            value={metricType}
            onChange={setMetricType}
            style={{ width: 100 }}
            size="small"
          >
            <Option value="mape">MAPE</Option>
            <Option value="mae">MAE</Option>
          </Select>
          <Select
            value={sortOrder}
            onChange={setSortOrder}
            style={{ width: 130 }}
            size="small"
          >
            <Option value="asc">Mejor → Peor</Option>
            <Option value="desc">Peor → Mejor</Option>
          </Select>
        </Space>
      }
    >
      <Spin spinning={loading}>
        {/* Summary Stats */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="Mejor Categoría"
                value={bestCategory?.value ? (typeof bestCategory.value === 'number' ? bestCategory.value.toFixed(2) : parseFloat(bestCategory.value).toFixed(2)) : '-'}
                suffix={metricType === 'mape' ? '%' : ''}
                prefix={<TrophyOutlined />}
                valueStyle={{ color: '#52c41a', fontSize: '20px' }}
              />
              <div style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>
                {bestCategory?.category || 'N/A'}
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="Promedio General"
                value={(typeof avgValue === 'number' && !isNaN(avgValue)) ? avgValue.toFixed(2) : '0.00'}
                suffix={metricType === 'mape' ? '%' : ''}
                valueStyle={{ fontSize: '20px' }}
              />
              <div style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>
                {data.length} categorías
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="Peor Categoría"
                value={worstCategory?.value ? (typeof worstCategory.value === 'number' ? worstCategory.value.toFixed(2) : parseFloat(worstCategory.value).toFixed(2)) : '-'}
                suffix={metricType === 'mape' ? '%' : ''}
                prefix={<WarningOutlined />}
                valueStyle={{ color: '#ff4d4f', fontSize: '20px' }}
              />
              <div style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>
                {worstCategory?.category || 'N/A'}
              </div>
            </Card>
          </Col>
        </Row>

        {/* Chart */}
        {processedData.length > 0 ? (
          <>
            <Column {...config} height={400} />
            
            {/* Legend */}
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Space>
                <Tag color="success">{'< 10%'} Excelente</Tag>
                <Tag color="processing">10-20% Bueno</Tag>
                <Tag color="warning">20-50% Aceptable</Tag>
                <Tag color="error">{`> 50%`} Revisar</Tag>
              </Space>
            </div>
          </>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: '50px 0', 
            color: '#8c8c8c' 
          }}>
            No hay datos disponibles
          </div>
        )}
      </Spin>
    </Card>
  );
};

export default CategoryAccuracyComparison;
