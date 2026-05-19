import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp,
  where,
  getDocs,
  limit,
  setDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { 
  ProductionLine, 
  WireSupplier, 
  WireBatch, 
  WireCoil 
} from '../types';
import { 
  LayoutDashboard, 
  PackagePlus, 
  Barcode, 
  Settings, 
  Plus, 
  Trash2, 
  Save, 
  X, 
  Loader2, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert,
  Info, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronDown,
  ChevronRight,
  Calendar,
  Edit2,
  Factory,
  Truck,
  Weight,
  FileInput,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { parseWireQRCode, ParsedWireCoil } from '../lib/wireUtils';
import { ConsumptionTab } from '../components/wires/ConsumptionTab';
import { DashboardTab } from '../components/wires/DashboardTab';
import { ReceivingTab } from '../components/wires/ReceivingTab';
import { HistoryTab } from '../components/wires/HistoryTab';

const WireControl: React.FC = () => {
  const { user, isApproved, isManager, isAdmin, isMaster } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'receiving' | 'consumption' | 'history' | 'config'>('dashboard');
  const [showTabMenu, setShowTabMenu] = useState(false);
  
  // Filtering State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const dateShortcuts = [
    { label: 'Hoje', getValue: () => {
      const today = new Date().toISOString().split('T')[0];
      return { start: today, end: today };
    }},
    { label: 'Mês Atual', getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      return { start, end };
    }},
    { label: 'Mês Anterior', getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      return { start, end };
    }},
    { label: 'Últimos 30 Dias', getValue: () => {
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return { start, end };
    }}
  ];

  const handleDateShortcut = (shortcut: typeof dateShortcuts[0]) => {
    const { start, end } = shortcut.getValue();
    setStartDate(start);
    setEndDate(end);
  };
  
  // Data State
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [suppliers, setSuppliers] = useState<WireSupplier[]>([]);
  const [batches, setBatches] = useState<WireBatch[]>([]);
  const [coils, setCoils] = useState<WireCoil[]>([]);
  const [loading, setLoading] = useState(true);
  const [productionData, setProductionData] = useState<any[]>([]);

  // Load Base Data
  useEffect(() => {
    if (!isApproved) return;

    const unsubLines = onSnapshot(query(collection(db, 'production_lines'), orderBy('name')), (snap) => {
      setLines(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionLine)));
    });

    const unsubSuppliers = onSnapshot(query(collection(db, 'wire_suppliers'), orderBy('name')), (snap) => {
      setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WireSupplier)));
    });

    const unsubBatches = onSnapshot(query(collection(db, 'wire_batches'), orderBy('createdAt', 'desc'), limit(50)), (snap) => {
      setBatches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WireBatch)));
    });

    const unsubCoils = onSnapshot(query(collection(db, 'wire_coils'), orderBy('receivedAt', 'desc'), limit(300)), (snap) => {
      setCoils(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WireCoil)));
    });
    
    const unsubProd = onSnapshot(collection(db, 'monthly_production'), (snap) => {
      setProductionData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    setLoading(false);
    return () => {
      unsubLines();
      unsubSuppliers();
      unsubBatches();
      unsubCoils();
      unsubProd();
    };
  }, [isApproved]);

  if (!isApproved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <ShieldAlert className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Acesso Restrito</h2>
        <p className="text-slate-500 max-w-xs">Aguarde a aprovação do seu perfil para acessar o controle de arames.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Controle de Arames
            <div className="bg-emerald-100 text-emerald-600 text-[10px] uppercase px-2 py-1 rounded-md">Beta</div>
          </h1>
          <p className="text-slate-500 font-medium">Gestão de recebimento e consumo de matérias-primas</p>
        </div>

        {/* Tabs */}
        <div className="relative">
          <button
            onClick={() => setShowTabMenu(!showTabMenu)}
            className="flex items-center gap-3 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-black uppercase tracking-tight text-slate-700 shadow-sm hover:border-emerald-200 transition-all active:scale-95"
          >
            {activeTab === 'dashboard' && <><LayoutDashboard className="w-5 h-5 text-emerald-600" /> Painel</>}
            {activeTab === 'receiving' && <><PackagePlus className="w-5 h-5 text-emerald-600" /> Receber</>}
            {activeTab === 'consumption' && <><Barcode className="w-5 h-5 text-emerald-600" /> Consumo</>}
            {activeTab === 'history' && <><History className="w-5 h-5 text-emerald-600" /> Histórico</>}
            {activeTab === 'config' && <><Settings className="w-5 h-5 text-emerald-600" /> Ajustes</>}
            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", showTabMenu && "rotate-180")} />
          </button>

          <AnimatePresence>
            {showTabMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowTabMenu(false)} 
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl z-20 overflow-hidden p-1.5"
                >
                  <button
                    onClick={() => { setActiveTab('dashboard'); setShowTabMenu(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-xs font-black uppercase tracking-tight transition-all",
                      activeTab === 'dashboard' ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <LayoutDashboard className="w-4 h-4" /> Painel Geral
                  </button>
                  
                  {(isManager || isAdmin || isMaster) && (
                    <button
                      onClick={() => { setActiveTab('receiving'); setShowTabMenu(false); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-xs font-black uppercase tracking-tight transition-all",
                        activeTab === 'receiving' ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      <PackagePlus className="w-4 h-4" /> Recebimento
                    </button>
                  )}

                  <button
                    onClick={() => { setActiveTab('consumption'); setShowTabMenu(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-xs font-black uppercase tracking-tight transition-all",
                      activeTab === 'consumption' ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <Barcode className="w-4 h-4" /> Registrar Consumo
                  </button>

                  {(isManager || isAdmin || isMaster) && (
                    <button
                      onClick={() => { setActiveTab('history'); setShowTabMenu(false); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-xs font-black uppercase tracking-tight transition-all",
                        activeTab === 'history' ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      <History className="w-4 h-4" /> Histórico de Lotes
                    </button>
                  )}

                  {(isAdmin || isMaster) && (
                    <button
                      onClick={() => { setActiveTab('config'); setShowTabMenu(false); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-xs font-black uppercase tracking-tight transition-all",
                        activeTab === 'config' ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      <Settings className="w-4 h-4" /> Configurações
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Global Period Filter (Dashboard & History) */}
      {(activeTab === 'dashboard' || activeTab === 'history') && (
        <div className="mb-8 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {dateShortcuts.map(s => (
              <button
                key={s.label}
                onClick={() => handleDateShortcut(s)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm active:scale-95"
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="bg-white p-4 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Período</span>
            </div>

            <div className="flex items-center gap-2 flex-grow sm:flex-grow-0 text-slate-600 font-bold text-sm">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-slate-300">até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="flex items-center gap-2 px-3 py-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest ml-auto"
              >
                <X className="w-3 h-3" />
                Limpar Período
              </button>
            )}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'config' && (isAdmin || isMaster) && (
          <motion.div
            key="config"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <ConfigTab lines={lines} suppliers={suppliers} />
          </motion.div>
        )}
        
          {activeTab === 'receiving' && (
           <motion.div
            key="receiving"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <ReceivingTab suppliers={suppliers} isManager={isManager} />
          </motion.div>
        )}

        {activeTab === 'history' && (isManager || isAdmin || isMaster) && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <HistoryTab 
                batches={batches} 
                suppliers={suppliers} 
                lines={lines} 
                isAdmin={isAdmin || isMaster}
                isManager={isManager}
                startDate={startDate}
                endDate={endDate}
            />
          </motion.div>
        )}

        {/* Dashboard and Consumption */}
        {activeTab === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <DashboardTab 
                batches={batches} 
                coils={coils} 
                suppliers={suppliers} 
                lines={lines}
                startDate={startDate}
                endDate={endDate} 
                productionData={productionData}
            />
          </motion.div>
        )}
        {activeTab === 'consumption' && (
          <motion.div
            key="consumption"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <ConsumptionTab lines={lines} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Sub-component for Config
const ConfigTab: React.FC<{ lines: ProductionLine[], suppliers: WireSupplier[] }> = ({ lines, suppliers }) => {
  const { profile } = useAuth();
  const [newLine, setNewLine] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [productionHistory, setProductionHistory] = useState<any[]>([]);
  
  // Production Entry Form
  const [prodYear, setProdYear] = useState(new Date().getFullYear());
  const [prodMonth, setProdMonth] = useState(new Date().getMonth() + 1);
  const [prodTons, setProdTons] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'monthly_production'), orderBy('year', 'desc'), orderBy('month', 'desc'), limit(12));
    const unsub = onSnapshot(q, (snap) => {
      setProductionHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Check if current selection has data
  useEffect(() => {
    const existing = productionHistory.find(h => h.year === prodYear && h.month === prodMonth);
    if (existing && !isEditing) {
      setProdTons(existing.productionTons.toString());
    } else if (!existing && !isEditing) {
      setProdTons('');
    }
  }, [prodYear, prodMonth, productionHistory, isEditing]);

  const handleSaveProduction = async () => {
    if (!prodTons || isNaN(parseFloat(prodTons))) return;
    
    const id = `${prodYear}-${prodMonth}`;
    await setDoc(doc(db, 'monthly_production', id), {
      year: prodYear,
      month: prodMonth,
      productionTons: parseFloat(prodTons),
      updatedAt: serverTimestamp(),
      updatedBy: profile?.displayName || profile?.email || 'Sistema'
    });
    setProdTons('');
    setIsEditing(false);
  };

  const handleEditClick = (entry: any) => {
    setProdYear(entry.year);
    setProdMonth(entry.month);
    setProdTons(entry.productionTons.toString());
    setIsEditing(true);
    // Scroll to form or just let the user see the change
  };

  const deleteProduction = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este registro de produção?')) {
      await deleteDoc(doc(db, 'monthly_production', id));
    }
  };

  const handleAddLine = async () => {
    if (!newLine) return;
    await addDoc(collection(db, 'production_lines'), {
      name: newLine,
      active: true,
      order: lines.length + 1
    });
    setNewLine('');
  };

  const handleAddSupplier = async () => {
    if (!newSupplier) return;
    await addDoc(collection(db, 'wire_suppliers'), {
      name: newSupplier,
      active: true
    });
    setNewSupplier('');
  };

  const toggleLine = async (id: string, active: boolean) => {
    await updateDoc(doc(db, 'production_lines', id), { active });
  };

  const deleteLine = async (id: string) => {
    await deleteDoc(doc(db, 'production_lines', id));
  };

  const deleteSupplier = async (id: string) => {
    await deleteDoc(doc(db, 'wire_suppliers', id));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {/* Monthly Production Input */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:shadow-md">
        <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
          <FileInput className="w-5 h-5 text-emerald-600" />
          Produção de Pregos (Tons)
        </h3>

        <div className="space-y-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
           <div className="grid grid-cols-2 gap-2">
              <select 
                value={prodMonth}
                onChange={(e) => setProdMonth(parseInt(e.target.value))}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select 
                value={prodYear}
                onChange={(e) => setProdYear(parseInt(e.target.value))}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {[2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
           </div>
           
           <div className="flex gap-2">
             <div className="relative flex-1">
               <input
                 type="number"
                 step="0.1"
                 value={prodTons}
                 onChange={(e) => setProdTons(e.target.value)}
                 placeholder="Total em toneladas..."
                 className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold pr-12"
               />
               <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">Tons</span>
             </div>
             <button
               onClick={handleSaveProduction}
               className="p-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all font-bold shadow-lg shadow-emerald-100 flex items-center gap-2"
             >
               <Save className="w-6 h-6" />
               <span className="text-xs uppercase tracking-widest hidden sm:inline">{isEditing ? 'Atualizar' : 'Salvar'}</span>
             </button>
           </div>
        </div>

        <div className="space-y-2">
           {productionHistory.map(entry => (
             <div key={entry.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group border border-transparent hover:border-emerald-100 hover:bg-white transition-all">
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {new Date(0, entry.month - 1).toLocaleString('pt-BR', { month: 'short' })} / {entry.year}
                  </p>
                  <p className="font-black text-slate-900 tracking-tight">{entry.productionTons.toLocaleString()} toneladas</p>
               </div>
               <div className="flex items-center gap-1">
                 <button
                    onClick={() => handleEditClick(entry)}
                    className="p-2 text-slate-300 hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="Editar"
                 >
                   <Edit2 className="w-4 h-4" />
                 </button>
                 <button
                    onClick={() => deleteProduction(entry.id)}
                    className="p-2 text-rose-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="Excluir"
                 >
                   <Trash2 className="w-4 h-4" />
                 </button>
               </div>
             </div>
           ))}
        </div>
      </div>

      {/* Production Lines */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:shadow-md">
        <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
          <Factory className="w-5 h-5 text-emerald-600" />
          Linhas de Operação
        </h3>
        
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={newLine}
            onChange={(e) => setNewLine(e.target.value)}
            placeholder="Nome da linha (Ex: A, B...)"
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
          />
          <button
            onClick={handleAddLine}
            className="p-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all font-bold shadow-lg shadow-emerald-100"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-2">
          {lines.map(line => (
            <div key={line.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group border border-transparent hover:border-emerald-100 hover:bg-white transition-all">
              <span className={cn("font-black tracking-tight", !line.active && "text-slate-400 line-through")}>{line.name}</span>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => toggleLine(line.id, !line.active)}
                  className={cn("p-2 rounded-xl transition-all", line.active ? "text-amber-500 hover:bg-amber-50" : "text-emerald-500 hover:bg-emerald-50")}
                >
                  <Save className="w-5 h-5" />
                </button>
                <button
                  onClick={() => deleteLine(line.id)}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suppliers */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:shadow-md">
        <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
          <Truck className="w-5 h-5 text-emerald-600" />
          Fornecedores
        </h3>
        
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newSupplier}
            onChange={(e) => setNewSupplier(e.target.value)}
            placeholder="Ex: Belgo, Morlan..."
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
          />
          <button
            onClick={handleAddSupplier}
            className="p-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all font-bold shadow-lg shadow-emerald-100"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 font-bold mb-6 ml-2 italic">
          * Use nomes como "Belgo" ou "Morlan" para habilitar o reconhecimento automático via scanner.
        </p>

        <div className="space-y-2">
          {suppliers.map(s => (
            <div key={s.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group border border-transparent hover:border-emerald-100 hover:bg-white transition-all">
              <span className={cn("font-black tracking-tight", !s.active && "text-slate-400 line-through")}>{s.name}</span>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => deleteSupplier(s.id)}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WireControl;
