import React, { useMemo, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend,
  LabelList
} from 'recharts';
import { WireBatch, WireCoil, WireSupplier, ProductionLine } from '../../types';
import { 
  TrendingUp, 
  Package, 
  ArrowUpRight, 
  ArrowDownRight, 
  Weight, 
  PieChart as PieChartIcon,
  Filter,
  Calendar,
  History,
  Search,
  Truck,
  X
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface DashboardTabProps {
  batches: WireBatch[];
  coils: WireCoil[];
  suppliers: WireSupplier[];
  lines: ProductionLine[];
  startDate: string;
  endDate: string;
  productionData: any[];
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ 
  batches, 
  coils, 
  suppliers, 
  lines,
  startDate,
  endDate,
  productionData
}) => {
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterDiameter, setFilterDiameter] = useState<string>('');

  // Analytics
  const filteredReceived = useMemo(() => {
    let filtered = [...coils];
    if (filterSupplier) filtered = filtered.filter(c => c.supplierId === filterSupplier);
    if (filterDiameter) filtered = filtered.filter(c => c.diameter.toString() === filterDiameter);
    
    if (startDate || endDate) {
      filtered = filtered.filter(c => {
        const receivedTimestamp = c.receivedAt?.seconds ? c.receivedAt.seconds * 1000 : c.receivedAt;
        if (!receivedTimestamp) return false;
        const receivedDate = new Date(receivedTimestamp);
        
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (receivedDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (receivedDate > end) return false;
        }
        return true;
      });
    }
    return filtered;
  }, [coils, filterSupplier, filterDiameter, startDate, endDate]);

  const filteredConsumed = useMemo(() => {
    let filtered = coils.filter(c => c.status === 'consumed');
    if (filterSupplier) filtered = filtered.filter(c => c.supplierId === filterSupplier);
    if (filterDiameter) filtered = filtered.filter(c => c.diameter.toString() === filterDiameter);
    
    if (startDate || endDate) {
      filtered = filtered.filter(c => {
        const consumedTimestamp = c.consumedAt?.seconds ? c.consumedAt.seconds * 1000 : c.consumedAt;
        if (!consumedTimestamp) return false;
        const consumedDate = new Date(consumedTimestamp);
        
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (consumedDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (consumedDate > end) return false;
        }
        return true;
      });
    } else {
      // Default to last 30 days if no filter
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filtered = filtered.filter(c => {
        const consumedTimestamp = c.consumedAt?.seconds ? c.consumedAt.seconds * 1000 : c.consumedAt;
        return consumedTimestamp && new Date(consumedTimestamp) >= thirtyDaysAgo;
      });
    }
    return filtered;
  }, [coils, filterSupplier, filterDiameter, startDate, endDate]);

  const stats = useMemo(() => {
    const totalReceived = filteredReceived.length;
    const totalWeight = filteredReceived.reduce((acc, c) => acc + (c.weight || 0), 0);
    const totalConsumed = filteredConsumed.length;
    const currentStock = coils.filter(c => c.status !== 'consumed').length;
    const stockWeight = coils.filter(c => c.status !== 'consumed').reduce((acc, c) => acc + (c.weight || 0), 0);

    // Group by supplier (Only current stock for clarity)
    const stockCoils = coils.filter(c => c.status !== 'consumed');
    const bySupplier = suppliers.map(s => ({
      name: s.name,
      value: stockCoils.filter(c => c.supplierId === s.id).length,
      weight: stockCoils.filter(c => c.supplierId === s.id).reduce((acc, c) => acc + (c.weight || 0), 0)
    })).filter(s => s.value > 0);

    // Add unrecorded coils to distribution
    const supplierIds = new Set(suppliers.map(s => s.id));
    const unrecordedCount = stockCoils.filter(c => !c.supplierId || !supplierIds.has(c.supplierId)).length;
    if (unrecordedCount > 0) {
      bySupplier.push({
        name: 'Não Identificado',
        value: unrecordedCount,
        weight: stockCoils.filter(c => !c.supplierId || !supplierIds.has(c.supplierId)).reduce((acc, c) => acc + (c.weight || 0), 0)
      });
    }

    // Group by diameter - Dynamic extraction
    const uniqueDiameters = Array.from(new Set(coils.map(c => c.diameter))).sort((a, b) => Number(a) - Number(b));
    const byDiameter = uniqueDiameters.map(d => ({
      name: `${d} mm`,
      count: filteredReceived.filter(c => c.diameter === d).length,
      weight: filteredReceived.filter(c => c.diameter === d).reduce((acc, c) => acc + (c.weight || 0), 0)
    }));

    const consumptionByLine = lines.map(l => {
      const lineConsumedCoils = filteredConsumed.filter(c => c.currentLineId === l.id);
      return {
        name: `Linha ${l.name}`,
        value: lineConsumedCoils.length,
        weight: lineConsumedCoils.reduce((acc, c) => acc + (c.weight || 0), 0)
      };
    }).filter(l => l.value > 0);

    return {
      totalReceived,
      totalWeight,
      totalConsumed,
      currentStock,
      stockWeight,
      bySupplier,
      byDiameter,
      byLine: consumptionByLine
    };
  }, [coils, filteredReceived, filteredConsumed, suppliers, lines]);

  const performanceStats = useMemo(() => {
    // Generate map of recorded production
    const prodMap = new Map();
    productionData.forEach(p => {
      prodMap.set(`${p.year}-${p.month}`, p.productionTons);
    });

    // Group coil consumption by month (last 6 months)
    const monthsData = [];
    const now = new Date();
    
    // Sort suppliers for consistent indexing
    const sortedSuppliers = [...suppliers].sort((a, b) => a.name.localeCompare(b.name));

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${month}`;
      
      const consumedInMonth = coils.filter(c => {
        if (c.status !== 'consumed') return false;
        const cDate = c.consumedAt?.seconds 
          ? new Date(c.consumedAt.seconds * 1000) 
          : c.consumedAt ? new Date(c.consumedAt) : null;
        const matchesDate = cDate && cDate.getFullYear() === year && (cDate.getMonth() + 1) === month;
        const matchesDiameter = !filterDiameter || c.diameter.toString() === filterDiameter;
        return matchesDate && matchesDiameter;
      });

      const totalKg = consumedInMonth.reduce((acc, c) => acc + (c.weight || 0), 0);
      const productionTons = prodMap.get(key) || 0;
      const specificCons = productionTons > 0 ? (totalKg / productionTons) : 0;

      // Breakdowns for this month
      const supplierBreakdown = sortedSuppliers.map(s => {
        const weight = consumedInMonth.filter(c => c.supplierId === s.id).reduce((acc, c) => acc + (c.weight || 0), 0);
        return {
          name: s.name,
          kg: weight,
          specific: productionTons > 0 ? (weight / productionTons) : 0
        };
      }).filter(s => s.kg > 0);

      const uniqueDiameters = Array.from(new Set(consumedInMonth.map(c => c.diameter))).sort((a, b) => Number(a) - Number(b));
      const diameterBreakdown = uniqueDiameters.map(dia => {
        const weight = consumedInMonth.filter(c => c.diameter === dia).reduce((acc, c) => acc + (c.weight || 0), 0);
        return {
          name: `${dia} mm`,
          kg: weight,
          specific: productionTons > 0 ? (weight / productionTons) : 0
        };
      });

      monthsData.push({
        label: d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }),
        kg: totalKg,
        tons: productionTons,
        specific: specificCons,
        suppliers: supplierBreakdown,
        diameters: diameterBreakdown,
        year,
        month
      });
    }

    // Calculate current breakdown based on filter if available
    let currentBreakdownData;
    if (startDate || endDate) {
      // Aggregate specific consumption over the filtered period
      const filteredConsumedForStats = coils.filter(c => {
        if (c.status !== 'consumed') return false;
        const cDate = c.consumedAt?.seconds ? new Date(c.consumedAt.seconds * 1000) : new Date(c.consumedAt);
        if (startDate && cDate < new Date(startDate)) return false;
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23,59,59,999);
          if (cDate > end) return false;
        }
        if (filterDiameter && c.diameter.toString() !== filterDiameter) return false;
        return true;
      });

      const totalWeight = filteredConsumedForStats.reduce((acc, c) => acc + (c.weight || 0), 0);
      
      // Attempt to estimate production tons based on months in filter
      // (Simplified: sum tons for any month touched by filter)
      const monthsInRange = new Set();
      if (startDate && endDate) {
          let curr = new Date(startDate);
          const end = new Date(endDate);
          while (curr <= end) {
              monthsInRange.add(`${curr.getFullYear()}-${curr.getMonth() + 1}`);
              curr.setMonth(curr.getMonth() + 1);
          }
      } else if (startDate) {
          monthsInRange.add(`${new Date(startDate).getFullYear()}-${new Date(startDate).getMonth() + 1}`);
      }
      
      let productionTonsInRange = 0;
      monthsInRange.forEach(key => {
          productionTonsInRange += prodMap.get(key) || 0;
      });

      const avgSpecific = productionTonsInRange > 0 ? (totalWeight / productionTonsInRange) : 0;

      const supplierBreakdown = sortedSuppliers.map(s => {
        const weight = filteredConsumedForStats.filter(c => c.supplierId === s.id).reduce((acc, c) => acc + (c.weight || 0), 0);
        return {
          name: s.name,
          kg: weight,
          specific: productionTonsInRange > 0 ? (weight / productionTonsInRange) : 0
        };
      }).filter(s => s.kg > 0);

      const uniqueDiameters = Array.from(new Set(filteredConsumedForStats.map(c => c.diameter))).sort((a, b) => Number(a) - Number(b));
      const diameterBreakdown = uniqueDiameters.map(dia => {
        const weight = filteredConsumedForStats.filter(c => c.diameter === dia).reduce((acc, c) => acc + (c.weight || 0), 0);
        return {
          name: `${dia} mm`,
          kg: weight,
          specific: productionTonsInRange > 0 ? (weight / productionTonsInRange) : 0
        };
      });

      currentBreakdownData = {
          specific: avgSpecific,
          suppliers: supplierBreakdown,
          diameters: diameterBreakdown,
          label: 'Período Filtrado'
      };
    } else {
      currentBreakdownData = monthsData[monthsData.length - 1];
    }

    return {
        trend: monthsData,
        current: currentBreakdownData
    };
  }, [coils, productionData, suppliers, startDate, endDate, filterDiameter]);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  const uniqueAvailableDiameters = useMemo(() => {
    return Array.from(new Set(coils.map(c => c.diameter))).sort((a, b) => Number(a) - Number(b));
  }, [coils]);

  return (
    <div className="space-y-8">
      {/* Filters (Supplier & Diameter) */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase">Filtros:</span>
        </div>

        <select
          value={filterSupplier}
          onChange={(e) => setFilterSupplier(e.target.value)}
          className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Todos Fornecedores</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          value={filterDiameter}
          onChange={(e) => setFilterDiameter(e.target.value)}
          className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Todas Bitolas</option>
          {uniqueAvailableDiameters.map(d => (
            <option key={d} value={d.toString()}>{d} mm</option>
          ))}
        </select>

        {(filterSupplier || filterDiameter) && (
          <button
            onClick={() => { setFilterSupplier(''); setFilterDiameter(''); }}
            className="flex items-center gap-2 px-4 py-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all text-sm font-black w-full sm:w-auto justify-center"
          >
            <X className="w-4 h-4" />
            Limpar Filtros
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Recebido</span>
          </div>
          <p className="text-3xl font-black text-slate-900 leading-none mb-1">{stats.totalReceived}</p>
          <p className="text-xs font-bold text-slate-400">bobinas esta carga</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Weight className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Peso Total</span>
          </div>
          <p className="text-3xl font-black text-slate-900 leading-none mb-1">{stats.totalWeight.toLocaleString()} <span className="text-sm">kg</span></p>
          <p className="text-xs font-bold text-slate-400">recebido acumulado</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Consumo</span>
          </div>
          <p className="text-3xl font-black text-slate-900 leading-none mb-1">{stats.totalConsumed}</p>
          <p className="text-xs font-bold text-slate-400">bobinas produzidas</p>
        </div>

        <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl shadow-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Estoque Atual</span>
          </div>
          <p className="text-3xl font-black text-white leading-none mb-1">{stats.currentStock}</p>
          <p className="text-xs font-bold text-emerald-500/60">{stats.stockWeight.toLocaleString()} kg em pátio</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Suppliers Pie */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-emerald-600" />
              Estoque por Fornecedor
            </h3>
            <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-md uppercase tracking-widest">Apenas Disponível</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.bySupplier}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.bySupplier.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Consumed by Line */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Consumo por Linha
            </h3>
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-md tracking-tighter">
              <Calendar className="w-3 h-3" />
              {startDate || endDate ? 'Período Selecionado' : 'Últimos 30 dias'}
            </div>
          </div>
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byLine}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(value: any) => [`${value} bobinas`, 'Quantidade']}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Consumption Table */}
          <div className="border-t border-slate-100 pt-6">
             <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="pb-2">Linha</th>
                    <th className="pb-2 text-center">Bobinas</th>
                    <th className="pb-2 text-right">Peso (kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.byLine.map((item, idx) => (
                    <tr key={`line-row-${item.name}-${idx}`} className="text-sm font-bold text-slate-700">
                      <td className="py-2">{item.name}</td>
                      <td className="py-2 text-center text-slate-900">{item.value}</td>
                      <td className="py-2 text-right text-emerald-600 tabular-nums">{item.weight.toLocaleString()}</td>
                    </tr>
                  ))}
                  {stats.byLine.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400 text-xs italic font-medium">Nenhum consumo registrado no período.</td>
                    </tr>
                  )}
                </tbody>
             </table>
          </div>
        </div>

        {/* Diameters Bar */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
            <Filter className="w-5 h-5 text-amber-600" />
            Volumes e Quantidades por Bitola (mm)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byDiameter} layout="vertical" margin={{ left: 20, right: 60 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontWeight: 800, fontSize: 12 }} width={80} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="weight" name="Peso (kg)" fill="#10b981" radius={[0, 8, 8, 0]} barSize={40}>
                   <LabelList 
                      dataKey="count" 
                      position="right" 
                      formatter={(val: number) => `${val} un`}
                      style={{ fill: '#475569', fontWeight: 900, fontSize: 11 }}
                   />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Specific Consumption (Arame / Produção) */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-emerald-200 shadow-sm lg:col-span-2 ring-4 ring-emerald-50">
           <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Consumo Específico (kg Arame / Ton Unidade)
              </h3>
              <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-full">Indústria 4.0</div>
           </div>
           <p className="text-xs font-bold text-slate-400 mb-8">Relação entre arame consumido e produção total manual registrada.</p>
           
           <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceStats.trend} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#3b82f6', fontSize: 10, fontWeight: 700 }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#10b981', fontSize: 10, fontWeight: 700 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="top" align="right" />
                  <Bar yAxisId="left" dataKey="kg" name="Arame (kg)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="tons" name="Prod. (tons)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="specific" name="Cons. Específico" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 pt-12 border-t border-slate-100">
              {/* Breakdown by Supplier */}
              <div>
                 <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                       <Truck className="w-4 h-4 text-emerald-600" />
                       Eficiência por Fornecedor (kg/ton)
                    </h4>
                    <span className="text-[9px] font-black text-slate-400">{performanceStats.current.label}</span>
                 </div>
                 <div className="space-y-3">
                    {performanceStats.current.suppliers.map((s: any, idx: number) => (
                       <div key={`${s.name}-${idx}`}>
                          <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase mb-1">
                             <span>{s.name}</span>
                             <span>{s.specific.toFixed(1)} kg/ton</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                             <div 
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(100, (s.specific / (performanceStats.current.specific || 1)) * 100)}%` }}
                             />
                          </div>
                       </div>
                    ))}
                    {(!performanceStats.current.suppliers || performanceStats.current.suppliers.length === 0) && (
                       <p className="text-xs italic text-slate-400">Sem dados de consumo para este período.</p>
                    )}
                 </div>
              </div>

              {/* Breakdown by Diameter */}
              <div>
                 <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                       <Weight className="w-4 h-4 text-blue-600" />
                       Eficiência por Bitola (kg/ton)
                    </h4>
                    <span className="text-[9px] font-black text-slate-400">{performanceStats.current.label}</span>
                 </div>
                 <div className="space-y-3">
                    {performanceStats.current.diameters.map((d: any, idx: number) => (
                       <div key={`${d.name}-${idx}`}>
                          <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase mb-1">
                             <span>{d.name}</span>
                             <span>{d.specific.toFixed(1)} kg/ton</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                             <div 
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${Math.min(100, (d.specific / (performanceStats.current.specific || 1)) * 100)}%` }}
                             />
                          </div>
                       </div>
                    ))}
                    {(!performanceStats.current.diameters || performanceStats.current.diameters.length === 0) && (
                       <p className="text-xs italic text-slate-400">Sem dados de consumo para este período.</p>
                    )}
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-100">
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status {startDate || endDate ? 'do Filtro' : 'Atual'}</p>
                 <p className="text-lg font-black text-slate-900">
                   {performanceStats.current.specific.toFixed(1)} <span className="text-xs text-slate-400 font-bold tracking-normal">kg/ton</span>
                 </p>
              </div>
              <div className="col-span-2">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dica de Eficiência</p>
                 <p className="text-xs font-bold text-slate-600 leading-relaxed italic">
                   {performanceStats.current.specific > 100 
                    ? "O consumo está acima da média histórica. Verifique possíveis perdas ou sucatas no processo."
                    : "A eficiência de consumo está dentro dos padrões esperados de produção."}
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
