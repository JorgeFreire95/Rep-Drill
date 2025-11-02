#!/usr/bin/env python
"""
Performance Benchmark Script para Rep Drill System
Mide mejoras de performance en:
- ThreadPoolExecutor vs Sequential
- Async/Await vs Sync
- Distributed Cache vs No Cache
- Frontend Lazy Loading

Uso:
    python benchmark_performance.py --all
    python benchmark_performance.py --backend
    python benchmark_performance.py --cache
"""

import argparse
import time
import asyncio
import json
import sys
import os
from typing import Dict, List, Any
from dataclasses import dataclass, asdict
from datetime import datetime
import statistics

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_analytics.settings')
import django
django.setup()

from django.core.cache import cache
from backend.distributed_cache import distributed_cache


@dataclass
class BenchmarkResult:
    """Resultado de un benchmark."""
    name: str
    implementation: str  # 'sequential', 'threaded', 'async', 'cached', etc.
    duration_seconds: float
    operations_count: int
    ops_per_second: float
    memory_mb: float = 0.0
    error_count: int = 0
    
    def to_dict(self) -> Dict:
        return asdict(self)


class PerformanceBenchmark:
    """Suite de benchmarks de performance."""
    
    def __init__(self):
        self.results: List[BenchmarkResult] = []
    
    def add_result(self, result: BenchmarkResult):
        """Agregar resultado."""
        self.results.append(result)
        print(f"✅ {result.name} ({result.implementation}): "
              f"{result.duration_seconds:.3f}s - {result.ops_per_second:.1f} ops/s")
    
    def compare_results(self, baseline_name: str, comparison_name: str) -> Dict:
        """Comparar dos resultados."""
        baseline = next((r for r in self.results if r.name == baseline_name), None)
        comparison = next((r for r in self.results if r.name == comparison_name), None)
        
        if not baseline or not comparison:
            return {}
        
        speedup = baseline.duration_seconds / comparison.duration_seconds
        improvement = ((baseline.duration_seconds - comparison.duration_seconds) / 
                      baseline.duration_seconds * 100)
        
        return {
            'baseline': baseline.implementation,
            'comparison': comparison.implementation,
            'speedup': round(speedup, 2),
            'improvement_percentage': round(improvement, 1),
            'baseline_time': baseline.duration_seconds,
            'comparison_time': comparison.duration_seconds,
        }
    
    def generate_report(self) -> str:
        """Generar reporte completo."""
        report = []
        report.append("=" * 80)
        report.append("PERFORMANCE BENCHMARK REPORT")
        report.append("=" * 80)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"Total Tests: {len(self.results)}")
        report.append("")
        
        # Agrupar por categoría
        categories = {}
        for result in self.results:
            category = result.name.split(':')[0]
            if category not in categories:
                categories[category] = []
            categories[category].append(result)
        
        for category, results in categories.items():
            report.append(f"\n{category}")
            report.append("-" * 80)
            
            for result in results:
                report.append(f"  {result.implementation:20s} | "
                            f"{result.duration_seconds:8.3f}s | "
                            f"{result.ops_per_second:8.1f} ops/s | "
                            f"{result.operations_count:5d} ops")
            
            # Comparaciones
            if len(results) >= 2:
                baseline = results[0]
                for result in results[1:]:
                    speedup = baseline.duration_seconds / result.duration_seconds
                    improvement = ((baseline.duration_seconds - result.duration_seconds) / 
                                 baseline.duration_seconds * 100)
                    report.append(f"\n  ⚡ {result.implementation} vs {baseline.implementation}:")
                    report.append(f"     Speedup: {speedup:.2f}x")
                    report.append(f"     Improvement: {improvement:.1f}%")
        
        report.append("\n" + "=" * 80)
        return "\n".join(report)


# =============================================================================
# BACKEND BENCHMARKS
# =============================================================================

def benchmark_threaded_vs_sequential():
    """Benchmark ThreadPoolExecutor vs Sequential."""
    print("\n📊 Benchmarking: ThreadPoolExecutor vs Sequential")
    
    import concurrent.futures
    import multiprocessing
    
    # Simular análisis de productos (200ms por producto)
    def analyze_product(product_id: int) -> Dict:
        time.sleep(0.2)
        return {
            'product_id': product_id,
            'status': 'success',
            'reorder_point': 100,
        }
    
    products = list(range(20))  # 20 productos
    benchmark = PerformanceBenchmark()
    
    # Sequential
    start = time.time()
    results_seq = []
    for product_id in products:
        results_seq.append(analyze_product(product_id))
    duration_seq = time.time() - start
    
    benchmark.add_result(BenchmarkResult(
        name="Backend:Recommendations",
        implementation="Sequential",
        duration_seconds=duration_seq,
        operations_count=len(products),
        ops_per_second=len(products) / duration_seq
    ))
    
    # ThreadPoolExecutor
    max_workers = min(4, multiprocessing.cpu_count())
    start = time.time()
    results_threaded = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_product = {
            executor.submit(analyze_product, product_id): product_id 
            for product_id in products
        }
        for future in concurrent.futures.as_completed(future_to_product):
            results_threaded.append(future.result())
    duration_threaded = time.time() - start
    
    benchmark.add_result(BenchmarkResult(
        name="Backend:Recommendations",
        implementation="ThreadPoolExecutor",
        duration_seconds=duration_threaded,
        operations_count=len(products),
        ops_per_second=len(products) / duration_threaded
    ))
    
    return benchmark


async def benchmark_async_vs_sync():
    """Benchmark Async vs Sync."""
    print("\n📊 Benchmarking: Async/Await vs Sync")
    
    # Simular I/O-bound operation
    async def fetch_data_async(item_id: int) -> Dict:
        await asyncio.sleep(0.1)  # Simular network delay
        return {'id': item_id, 'data': 'fetched'}
    
    def fetch_data_sync(item_id: int) -> Dict:
        time.sleep(0.1)
        return {'id': item_id, 'data': 'fetched'}
    
    items = list(range(15))  # 15 items
    benchmark = PerformanceBenchmark()
    
    # Sync
    start = time.time()
    results_sync = [fetch_data_sync(item_id) for item_id in items]
    duration_sync = time.time() - start
    
    benchmark.add_result(BenchmarkResult(
        name="Backend:API Calls",
        implementation="Sync",
        duration_seconds=duration_sync,
        operations_count=len(items),
        ops_per_second=len(items) / duration_sync
    ))
    
    # Async
    start = time.time()
    tasks = [fetch_data_async(item_id) for item_id in items]
    results_async = await asyncio.gather(*tasks)
    duration_async = time.time() - start
    
    benchmark.add_result(BenchmarkResult(
        name="Backend:API Calls",
        implementation="Async/Await",
        duration_seconds=duration_async,
        operations_count=len(items),
        ops_per_second=len(items) / duration_async
    ))
    
    return benchmark


# =============================================================================
# CACHE BENCHMARKS
# =============================================================================

def benchmark_cache_performance():
    """Benchmark Distributed Cache vs No Cache."""
    print("\n📊 Benchmarking: Distributed Cache")
    
    # Función costosa simulada
    def expensive_calculation(key: int) -> Dict:
        time.sleep(0.05)  # 50ms de cálculo
        return {
            'key': key,
            'result': key * 2,
            'computed_at': time.time()
        }
    
    keys = list(range(50))  # 50 keys
    benchmark = PerformanceBenchmark()
    
    # Sin caché
    start = time.time()
    results_no_cache = [expensive_calculation(key) for key in keys]
    duration_no_cache = time.time() - start
    
    benchmark.add_result(BenchmarkResult(
        name="Cache:Lookups",
        implementation="No Cache",
        duration_seconds=duration_no_cache,
        operations_count=len(keys),
        ops_per_second=len(keys) / duration_no_cache
    ))
    
    # Con caché (primera vez - misses)
    distributed_cache.clear_all()
    start = time.time()
    results_cache_miss = []
    for key in keys:
        cache_key = f"bench:key_{key}"
        value = distributed_cache.get(cache_key)
        if value is None:
            value = expensive_calculation(key)
            distributed_cache.set(cache_key, value, timeout=300)
        results_cache_miss.append(value)
    duration_cache_miss = time.time() - start
    
    benchmark.add_result(BenchmarkResult(
        name="Cache:Lookups",
        implementation="Cache Miss",
        duration_seconds=duration_cache_miss,
        operations_count=len(keys),
        ops_per_second=len(keys) / duration_cache_miss
    ))
    
    # Con caché (segunda vez - hits)
    start = time.time()
    results_cache_hit = []
    for key in keys:
        cache_key = f"bench:key_{key}"
        value = distributed_cache.get(cache_key)
        if value is None:
            value = expensive_calculation(key)
            distributed_cache.set(cache_key, value, timeout=300)
        results_cache_hit.append(value)
    duration_cache_hit = time.time() - start
    
    benchmark.add_result(BenchmarkResult(
        name="Cache:Lookups",
        implementation="Cache Hit",
        duration_seconds=duration_cache_hit,
        operations_count=len(keys),
        ops_per_second=len(keys) / duration_cache_hit
    ))
    
    # Stats
    stats = distributed_cache.get_stats()
    print(f"\n   Cache Stats:")
    print(f"   - Hit Rate: {stats['hit_rate']}%")
    print(f"   - Total Ops: {stats['total_operations']}")
    
    # Cleanup
    distributed_cache.clear_all()
    
    return benchmark


# =============================================================================
# COMBINED BENCHMARKS
# =============================================================================

def benchmark_all():
    """Ejecutar todos los benchmarks."""
    print("\n" + "=" * 80)
    print("REP DRILL SYSTEM - PERFORMANCE BENCHMARK SUITE")
    print("=" * 80)
    
    all_results = []
    
    # Backend benchmarks
    print("\n🔧 BACKEND BENCHMARKS")
    print("-" * 80)
    
    bench1 = benchmark_threaded_vs_sequential()
    all_results.extend(bench1.results)
    
    bench2 = asyncio.run(benchmark_async_vs_sync())
    all_results.extend(bench2.results)
    
    # Cache benchmarks
    print("\n💾 CACHE BENCHMARKS")
    print("-" * 80)
    
    bench3 = benchmark_cache_performance()
    all_results.extend(bench3.results)
    
    # Generar reporte final
    final_benchmark = PerformanceBenchmark()
    final_benchmark.results = all_results
    
    report = final_benchmark.generate_report()
    print("\n" + report)
    
    # Guardar a archivo
    output_file = 'benchmark_results.json'
    with open(output_file, 'w') as f:
        json.dump([r.to_dict() for r in all_results], f, indent=2)
    
    print(f"\n💾 Results saved to: {output_file}")
    
    return final_benchmark


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Performance Benchmark Suite for Rep Drill'
    )
    parser.add_argument(
        '--all', 
        action='store_true',
        help='Run all benchmarks'
    )
    parser.add_argument(
        '--backend',
        action='store_true',
        help='Run backend benchmarks only'
    )
    parser.add_argument(
        '--cache',
        action='store_true',
        help='Run cache benchmarks only'
    )
    parser.add_argument(
        '--async',
        action='store_true',
        dest='async_test',
        help='Run async benchmarks only'
    )
    
    args = parser.parse_args()
    
    # Si no se especifica nada, ejecutar todos
    if not any([args.all, args.backend, args.cache, args.async_test]):
        args.all = True
    
    try:
        if args.all:
            benchmark_all()
        else:
            if args.backend:
                benchmark_threaded_vs_sequential()
            if args.async_test:
                asyncio.run(benchmark_async_vs_sync())
            if args.cache:
                benchmark_cache_performance()
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Benchmark interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Error running benchmark: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
