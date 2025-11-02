import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { analyticsService, type SalesTrendPoint } from '../../services/analyticsService';

type ChartPoint = {
	period: string;
	total_sales: number;
	total_orders: number;
};

const formatData = (points: SalesTrendPoint[]): ChartPoint[] =>
	points.map((p) => ({
		period: p.period,
		total_sales: Number(p.total_sales),
		total_orders: p.total_orders,
	}));

export const SalesCharts: React.FC = () => {
	const [data, setData] = useState<ChartPoint[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const load = async () => {
			try {
				setLoading(true);
				const trend = await analyticsService.getSalesTrend(30);
				setData(formatData(trend));
					} catch {
				setError('No se pudo cargar la tendencia de ventas');
			} finally {
				setLoading(false);
			}
		};
		void load();
	}, []);

	if (loading) return <div className="p-4 text-sm text-gray-500">Cargando métricas…</div>;
	if (error) return <div className="p-4 text-sm text-red-600">{error}</div>;

	return (
		<div className="w-full h-80">
			<ResponsiveContainer>
				<LineChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
					<CartesianGrid strokeDasharray="3 3" />
					<XAxis dataKey="period" tick={{ fontSize: 12 }} />
					<YAxis yAxisId="left" tick={{ fontSize: 12 }} />
					<YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
					<Tooltip formatter={(value) => (typeof value === 'number' ? value.toFixed(2) : value)} />
					<Legend />
					<Line yAxisId="left" type="monotone" dataKey="total_sales" name="Ventas ($)" stroke="#2563eb" strokeWidth={2} dot={false} />
					<Line yAxisId="right" type="monotone" dataKey="total_orders" name="Órdenes" stroke="#16a34a" strokeWidth={2} dot={false} />
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
};

export default SalesCharts;
