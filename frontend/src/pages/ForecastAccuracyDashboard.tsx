import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Statistic, 
  Row, 
  Col, 
  Button, 
  message, 
  Select, 
  DatePicker,
  Space,
  Tag,
  Tooltip
} from 'antd';
import { 
  ReloadOutlined, 
  TrophyOutlined, 
  WarningOutlined,
  LineChartOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { Line } from '@ant-design/charts';
import { analyticsService } from '../services/analyticsService';
import type { ForecastProductAccuracy, ForecastCategoryAccuracy } from '../types';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

/**
 * Dashboard de Precisión de Pronósticos
 * Muestra métricas MAPE y MAE por producto y categoría
 */
export const ForecastAccuracyDashboard: React.FC = () => {
  const [productAccuracy, setProductAccuracy] = useState<ForecastProductAccuracy[]>([]);
  const [categoryAccuracy, setCategoryAccuracy] = useState<ForecastCategoryAccuracy[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewType, setViewType] = useState<'product' | 'category'>('product');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  useEffect(() => {
    loadAccuracyData();
  }, [viewType, dateRange]);

  const loadAccuracyData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (dateRange) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }

      if (viewType === 'product') {
        const data = await analyticsService.getForecastProductAccuracy(params);
        const raw = Array.isArray(data) ? data : data.results || [];
        // Normalizar valores numéricos para evitar errores .toFixed sobre strings/undefined
        const normalized = raw.map((r: any) => ({
          ...r,
          mape: typeof r.mape === 'number' ? r.mape : parseFloat(r.mape) || 0,
          mae: typeof r.mae === 'number' ? r.mae : parseFloat(r.mae) || 0,
          record_count: typeof r.record_count === 'number' ? r.record_count : parseInt(r.record_count) || 0,
        }));
        setProductAccuracy(normalized);
      } else {
        const data = await analyticsService.getForecastCategoryAccuracy(params);
        const raw = Array.isArray(data) ? data : data.results || [];
        const normalized = raw.map((r: any) => ({
          ...r,
          mape: typeof r.mape === 'number' ? r.mape : parseFloat(r.mape) || 0,
          mae: typeof r.mae === 'number' ? r.mae : parseFloat(r.mae) || 0,
          product_count: typeof r.product_count === 'number' ? r.product_count : parseInt(r.product_count) || 0,
          record_count: typeof r.record_count === 'number' ? r.record_count : parseInt(r.record_count) || 0,
        }));
        setCategoryAccuracy(normalized);
      }
    } catch (error) {
      console.error('Error loading accuracy data:', error);
      message.error('Error al cargar métricas de precisión');
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary statistics
  const calculateSummary = () => {
    const data = viewType === 'product' ? productAccuracy : categoryAccuracy;
    if (data.length === 0) return { avgMape: 0, avgMae: 0, bestMape: 0, worstMape: 0 };

    // Asegurar valores numéricos
    const mapeValues = data.map(d => typeof d.mape === 'number' ? d.mape : parseFloat((d as any).mape) || 0);
    const maeValues = data.map(d => typeof d.mae === 'number' ? d.mae : parseFloat((d as any).mae) || 0);

    return {
      avgMape: mapeValues.reduce((a, b) => a + b, 0) / mapeValues.length,
      avgMae: maeValues.reduce((a, b) => a + b, 0) / maeValues.length,
      bestMape: Math.min(...mapeValues),
      worstMape: Math.max(...mapeValues),
      excellentCount: mapeValues.filter(m => m < 10).length,
      goodCount: mapeValues.filter(m => m >= 10 && m < 20).length,
      acceptableCount: mapeValues.filter(m => m >= 20 && m < 50).length,
      poorCount: mapeValues.filter(m => m >= 50).length,
    };
  };

  const summary = calculateSummary();

  const getMapeColor = (mape: number): string => {
    if (mape < 10) return '#52c41a'; // Excelente - Verde
    if (mape < 20) return '#1890ff'; // Bueno - Azul
    if (mape < 50) return '#faad14'; // Aceptable - Naranja
    return '#ff4d4f'; // Pobre - Rojo
  };

  const getMapeLabel = (mape: number): { text: string; color: string } => {
    if (mape < 10) return { text: 'Excelente', color: 'success' };
    if (mape < 20) return { text: 'Bueno', color: 'processing' };
    if (mape < 50) return { text: 'Aceptable', color: 'warning' };
    return { text: 'Revisar', color: 'error' };
  };

  const productColumns = [
    {
      title: 'Producto',
      dataIndex: 'product_name',
      key: 'product_name',
      fixed: 'left' as const,
      width: 200,
      render: (name: string, record: ForecastProductAccuracy) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{record.product_sku}</div>
        </div>
      ),
    },
    {
      title: <Tooltip title="Mean Absolute Percentage Error">MAPE (%)</Tooltip>,
      dataIndex: 'mape',
      key: 'mape',
      width: 120,
      sorter: (a: ForecastProductAccuracy, b: ForecastProductAccuracy) => a.mape - b.mape,
      render: (mape: number | string) => {
        const numMape = typeof mape === 'number' ? mape : parseFloat(mape) || 0;
        const label = getMapeLabel(numMape);
        return (
          <Space>
            <Tag color={label.color}>{label.text}</Tag>
            <span style={{ color: getMapeColor(numMape), fontWeight: 500 }}>
              {numMape.toFixed(2)}%
            </span>
          </Space>
        );
      },
    },
    {
      title: <Tooltip title="Mean Absolute Error">MAE</Tooltip>,
      dataIndex: 'mae',
      key: 'mae',
      width: 100,
      sorter: (a: ForecastProductAccuracy, b: ForecastProductAccuracy) => a.mae - b.mae,
      render: (mae: number | string) => {
        const numMae = typeof mae === 'number' ? mae : parseFloat(mae) || 0;
        return numMae.toFixed(2);
      },
    },
    {
      title: 'Registros',
      dataIndex: 'record_count',
      key: 'record_count',
      width: 100,
      sorter: (a: ForecastProductAccuracy, b: ForecastProductAccuracy) => 
        a.record_count - b.record_count,
    },
    {
      title: 'Periodo',
      key: 'period',
      width: 180,
      render: (_: any, record: ForecastProductAccuracy) => (
        <div style={{ fontSize: '12px' }}>
          <div>{dayjs(record.start_date).format('DD/MM/YYYY')}</div>
          <div>↓</div>
          <div>{dayjs(record.end_date).format('DD/MM/YYYY')}</div>
        </div>
      ),
    },
  ];

  const categoryColumns = [
    {
      title: 'Categoría',
      dataIndex: 'category_name',
      key: 'category_name',
      fixed: 'left' as const,
      width: 200,
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      title: <Tooltip title="Mean Absolute Percentage Error">MAPE (%)</Tooltip>,
      dataIndex: 'mape',
      key: 'mape',
      width: 120,
      sorter: (a: ForecastCategoryAccuracy, b: ForecastCategoryAccuracy) => a.mape - b.mape,
      render: (mape: number | string) => {
        const numMape = typeof mape === 'number' ? mape : parseFloat(mape) || 0;
        const label = getMapeLabel(numMape);
        return (
          <Space>
            <Tag color={label.color}>{label.text}</Tag>
            <span style={{ color: getMapeColor(numMape), fontWeight: 500 }}>
              {numMape.toFixed(2)}%
            </span>
          </Space>
        );
      },
    },
    {
      title: <Tooltip title="Mean Absolute Error">MAE</Tooltip>,
      dataIndex: 'mae',
      key: 'mae',
      width: 100,
      sorter: (a: ForecastCategoryAccuracy, b: ForecastCategoryAccuracy) => a.mae - b.mae,
      render: (mae: number | string) => {
        const numMae = typeof mae === 'number' ? mae : parseFloat(mae) || 0;
        return numMae.toFixed(2);
      },
    },
    {
      title: 'Productos',
      dataIndex: 'product_count',
      key: 'product_count',
      width: 100,
    },
    {
      title: 'Registros',
      dataIndex: 'record_count',
      key: 'record_count',
      width: 100,
      sorter: (a: ForecastCategoryAccuracy, b: ForecastCategoryAccuracy) => 
        a.record_count - b.record_count,
    },
    {
      title: 'Periodo',
      key: 'period',
      width: 180,
      render: (_: any, record: ForecastCategoryAccuracy) => (
        <div style={{ fontSize: '12px' }}>
          <div>{dayjs(record.start_date).format('DD/MM/YYYY')}</div>
          <div>↓</div>
          <div>{dayjs(record.end_date).format('DD/MM/YYYY')}</div>
        </div>
      ),
    },
  ];

  // Prepare chart data
  const chartData = (viewType === 'product' ? productAccuracy : categoryAccuracy)
    .slice(0, 10) // Top 10
    .map(item => ({
      name: 'product_name' in item ? item.product_name : item.category_name,
      mape: item.mape,
      mae: item.mae,
    }));

  const chartConfig = {
    data: chartData,
    xField: 'name',
    yField: 'mape',
    seriesField: 'type',
    smooth: true,
    point: {
      size: 5,
      shape: 'circle',
    },
    label: {
      style: {
        fill: '#aaa',
      },
    },
    xAxis: {
      label: {
        autoRotate: true,
        autoHide: true,
      },
    },
    yAxis: {
      label: {
        formatter: (v: string) => `${v}%`,
      },
    },
  };

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Dashboard de Precisión de Pronósticos</h1>
          <Space>
            <Select
              value={viewType}
              onChange={setViewType}
              style={{ width: 150 }}
            >
              <Option value="product">Por Producto</Option>
              <Option value="category">Por Categoría</Option>
            </Select>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
              placeholder={['Fecha inicio', 'Fecha fin']}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={loadAccuracyData}
              loading={loading}
            >
              Actualizar
            </Button>
          </Space>
        </div>

        {/* Summary Cards */}
        <Row gutter={16}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="MAPE Promedio"
                value={summary.avgMape.toFixed(2)}
                suffix="%"
                prefix={<LineChartOutlined />}
                valueStyle={{ 
                  color: getMapeColor(summary.avgMape),
                  fontSize: '24px'
                }}
              />
              <div style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>
                {getMapeLabel(summary.avgMape).text}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Mejor MAPE"
                value={summary.bestMape.toFixed(2)}
                suffix="%"
                prefix={<TrophyOutlined />}
                valueStyle={{ color: '#52c41a', fontSize: '24px' }}
              />
              <div style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>
                Excelente precisión
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Peor MAPE"
                value={summary.worstMape.toFixed(2)}
                suffix="%"
                prefix={<WarningOutlined />}
                valueStyle={{ color: '#ff4d4f', fontSize: '24px' }}
              />
              <div style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>
                Requiere atención
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="MAE Promedio"
                value={summary.avgMae.toFixed(2)}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ fontSize: '24px' }}
              />
              <div style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>
                Error absoluto medio
              </div>
            </Card>
          </Col>
        </Row>

        {/* Distribution Card */}
        <Card title="Distribución de Precisión">
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="Excelente (< 10%)"
                value={summary.excellentCount}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Bueno (10-20%)"
                value={summary.goodCount}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Aceptable (20-50%)"
                value={summary.acceptableCount}
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Revisar (> 50%)"
                value={summary.poorCount}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Col>
          </Row>
        </Card>

        {/* Chart */}
        {chartData.length > 0 && (
          <Card title={`Top 10 ${viewType === 'product' ? 'Productos' : 'Categorías'} - MAPE`}>
            <Line {...chartConfig} height={300} />
          </Card>
        )}

        {/* Info Alert */}
        <Card 
          type="inner" 
          title="📊 Interpretación de Métricas"
          style={{ backgroundColor: '#f0f5ff', borderColor: '#adc6ff' }}
        >
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <div><strong>MAPE (Mean Absolute Percentage Error):</strong></div>
              <ul style={{ marginLeft: 20, marginTop: 8 }}>
                <li><Tag color="success">{'< 10%'}</Tag> Excelente precisión</li>
                <li><Tag color="processing">10-20%</Tag> Buena precisión</li>
                <li><Tag color="warning">20-50%</Tag> Aceptable</li>
                <li><Tag color="error">{`> 50%`}</Tag> Revisar modelo o datos</li>
              </ul>
            </Col>
            <Col span={12}>
              <div><strong>MAE (Mean Absolute Error):</strong></div>
              <p style={{ marginTop: 8 }}>
                Error absoluto promedio en unidades. Ejemplo: MAE=15 significa un error 
                promedio de 15 unidades por predicción.
              </p>
              <p style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>
                Un MAE bajo indica que las predicciones están muy cerca de los valores reales.
              </p>
            </Col>
          </Row>
        </Card>

        {/* Table */}
        <Card title={`Precisión por ${viewType === 'product' ? 'Producto' : 'Categoría'}`}>
          <Table<any>
            columns={viewType === 'product' ? productColumns : categoryColumns}
            dataSource={viewType === 'product' ? productAccuracy : categoryAccuracy}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total: ${total} registros`,
            }}
            scroll={{ x: 1000 }}
          />
        </Card>
      </Space>
    </div>
  );
};

export default ForecastAccuracyDashboard;
