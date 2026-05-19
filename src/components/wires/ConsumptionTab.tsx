import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { ProductionLine, WireCoil } from '../../types';
import { 
  Barcode, 
  Factory, 
  Search, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2,
  X,
  History,
  Camera,
  Edit2,
  ChevronRight,
  Clock,
  Save,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { parseWireQRCode } from '../../lib/wireUtils';
import { QRCameraScanner } from './QRCameraScanner';
import { getCurrentShift, getGroupForShift, Shift } from '../../lib/scaleUtils';
import { ConfirmationModal } from '../ui/ConfirmationModal';

interface ConsumptionTabProps {
  lines: ProductionLine[];
}

export const ConsumptionTab: React.FC<ConsumptionTabProps> = ({ lines }) => {
  const { profile, isAdmin, isMaster } = useAuth();
  const [qrInput, setQrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [foundCoil, setFoundCoil] = useState<WireCoil | null>(null);
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedShift, setSelectedShift] = useState<'1' | '2' | '3' | ''>('');
  const [selectedEquipment, setSelectedEquipment] = useState('');

  const getShiftByTime = () => {
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 8) return '1';
    if (hour >= 8 && hour < 16) return '2';
    return '3';
  };

  useEffect(() => {
    // Auto-set shift based on current time
    setSelectedShift(getShiftByTime());
  }, [foundCoil]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  // History State
  const [recentConsumptions, setRecentConsumptions] = useState<WireCoil[]>([]);
  const [editingCoil, setEditingCoil] = useState<WireCoil | null>(null);
  const [newSelectedLine, setNewSelectedLine] = useState('');
  const [newSelectedShift, setNewSelectedShift] = useState<'1' | '2' | '3' | ''>('');
  const [newSelectedEquipment, setNewSelectedEquipment] = useState('');
  const [newSelectedGroup, setNewSelectedGroup] = useState<string>('');
  const [showGroupWarning, setShowGroupWarning] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onConfirm?: () => void;
    showConfirmButton?: boolean;
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    // Listen for recent consumptions
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'wire_coils'),
      where('status', '==', 'consumed'),
      where('consumedAt', '>=', today),
      orderBy('consumedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const coils = snap.docs.map(d => ({ id: d.id, ...d.data() } as WireCoil));
      setRecentConsumptions(coils);
    }, (err) => {
      console.error("Error listening to consumptions:", err);
    });

    return () => unsubscribe();
  }, []);

  const dailySummary = useMemo(() => {
    const groups: { [key: string]: { date: Date, items: WireCoil[], totalWeight: number, byDiameter: { [dia: number]: number } } } = {};
    
    recentConsumptions.forEach(coil => {
      const timestamp = coil.consumedAt?.seconds ? coil.consumedAt.seconds * 1000 : coil.consumedAt;
      if (!timestamp) return;
      const date = new Date(timestamp);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date,
          items: [],
          totalWeight: 0,
          byDiameter: {}
        };
      }
      groups[dateKey].items.push(coil);
      groups[dateKey].totalWeight += coil.weight || 0;
      groups[dateKey].byDiameter[coil.diameter] = (groups[dateKey].byDiameter[coil.diameter] || 0) + (coil.weight || 0);
    });

    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [recentConsumptions]);

  const equipmentOptions = useMemo(() => {
    if (!foundCoil || !selectedLine) return [];
    
    // 2.18mm e 2.30mm -> Amarradeira 1 e 2
    if (foundCoil.diameter < 3.0) {
      return ['Amarradeira 1', 'Amarradeira 2'];
    }
    
    // 3.00mm -> Unitizadora e Big Balé (apenas Linhas A e B)
    if (foundCoil.diameter === 3.0) {
      const lineName = lines.find(l => l.id === selectedLine)?.name || '';
      const isLineAOrB = lineName.toLowerCase().includes('linha a') || lineName.toLowerCase().includes('linha b');
      
      const options = ['Unitizadora'];
      if (isLineAOrB) options.push('Big Balé');
      return options;
    }
    
    return [];
  }, [foundCoil, selectedLine, lines]);

  const searchCoil = async (term: string) => {
    setLoading(true);
    setError('');
    setSuccess('');
    setFoundCoil(null);

    const parsed = parseWireQRCode(term);
    const searchTerm = parsed ? parsed.coilNumber : term;

    try {
      const q = query(
        collection(db, 'wire_coils'), 
        where('coilNumber', '==', searchTerm)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setError('Bobina não encontrada no sistema. Verifique o recebimento.');
      } else {
        const coilData = { id: snap.docs[0].id, ...snap.docs[0].data() } as WireCoil;
        
        if (coilData.status === 'consumed') {
          const consumedDate = coilData.consumedAt?.seconds 
            ? new Date(coilData.consumedAt.seconds * 1000).toLocaleString()
            : 'data desconhecida';
          setError(`Esta bobina já foi consumida em ${consumedDate}.`);
        } else {
          setFoundCoil(coilData);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao buscar bobina.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrInput) return;
    await searchCoil(qrInput);
    setQrInput('');
  };

  const handleConsume = async (bypassWarning = false) => {
    if (!foundCoil || !selectedLine || !selectedShift || !selectedEquipment) return;

    // Validate Group
    const expectedShiftName = `Turno ${selectedShift}` as Shift;
    const expectedGroup = getGroupForShift(new Date(), expectedShiftName);
    
    if (profile?.group && profile.group !== expectedGroup && !showGroupWarning && !bypassWarning) {
      setShowGroupWarning(true);
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'wire_coils', foundCoil.id), {
        status: 'consumed',
        currentLineId: selectedLine,
        consumedShift: selectedShift,
        consumedIn: selectedEquipment,
        consumedAt: serverTimestamp(),
        consumedBy: profile?.displayName || profile?.email || 'Sistema',
        consumedByGroup: profile?.group || '-'
      });

      setSuccess(`Bobina ${foundCoil.coilNumber} registrada com sucesso na ${selectedEquipment} (${lines.find(l => l.id === selectedLine)?.name}).`);
      setFoundCoil(null);
      setSelectedLine('');
      setSelectedShift('');
      setSelectedEquipment('');
      setShowGroupWarning(false);
    } catch (err) {
      console.error(err);
      setError('Erro ao registrar consumo.');
    } finally {
      setLoading(false);
    }
  };

  const isEditable = (coil: WireCoil) => {
    if (isAdmin || isMaster) return true;
    
    if (!coil.consumedAt) return false;
    
    const consumedDate = new Date(coil.consumedAt.seconds * 1000);
    const today = new Date();
    
    return consumedDate.getDate() === today.getDate() &&
           consumedDate.getMonth() === today.getMonth() &&
           consumedDate.getFullYear() === today.getFullYear();
  };

  const handleEditCorrection = async () => {
    if (!editingCoil || !newSelectedLine || !newSelectedShift || !newSelectedEquipment) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'wire_coils', editingCoil.id), {
        currentLineId: newSelectedLine,
        consumedShift: newSelectedShift,
        consumedIn: newSelectedEquipment,
        consumedByGroup: newSelectedGroup || '-',
        updatedAt: serverTimestamp(),
        updatedBy: profile?.displayName || profile?.email || 'Sistema'
      });
      setEditingCoil(null);
      setNewSelectedLine('');
      setNewSelectedShift('');
      setNewSelectedEquipment('');
      setNewSelectedGroup('');
      setModalConfig({
        isOpen: true,
        title: 'Sucesso!',
        message: 'Consumo atualizado com sucesso!',
        type: 'success'
      });
    } catch (err) {
      console.error(err);
      setModalConfig({
        isOpen: true,
        title: 'Erro',
        message: 'Erro ao atualizar registro.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        showConfirmButton={modalConfig.showConfirmButton}
        onConfirm={modalConfig.onConfirm}
        confirmText={modalConfig.confirmText}
      />

      {isCameraOpen && (
        <QRCameraScanner 
          onScan={searchCoil} 
          onClose={() => setIsCameraOpen(false)} 
        />
      )}

      {/* Scanner Area */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
           <Barcode className="w-32 h-32" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
            <div>
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <Barcode className="w-8 h-8 text-emerald-600" />
                Consumo de Arame
              </h2>
              <p className="text-slate-500 font-medium text-sm mt-1">Bipe a bobina para registrar o consumo na linha.</p>
            </div>
            <button
               onClick={() => setIsCameraOpen(true)}
               className="w-full md:w-auto flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 text-white rounded-2xl text-base font-black hover:bg-emerald-700 transition-all border border-emerald-500 shadow-lg shadow-emerald-100 active:scale-95"
            >
              <Camera className="w-6 h-6" />
              Ligar Câmera
            </button>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <input
              autoFocus
              type="text"
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              placeholder="Digite o ID ou use o leitor..."
              className="flex-1 px-6 py-5 bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl text-xl font-mono outline-none transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-5 sm:py-0 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-black transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Confirmar'}
            </button>
          </form>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 font-bold"
              >
                <AlertTriangle className="w-5 h-5" />
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600 font-bold"
              >
                <CheckCircle2 className="w-5 h-5" />
                {success}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Result Area */}
      <AnimatePresence>
        {foundCoil && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border-2 border-emerald-500 shadow-2xl shadow-emerald-100"
          >
            <div className="flex flex-col gap-8">
              <div className="w-full">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-[1.25rem] flex items-center justify-center font-black">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">Bobina Encontrada</h3>
                    <p className="text-slate-500 font-black text-sm tracking-widest">{foundCoil.coilNumber}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Diâmetro</p>
                    <p className="text-xl font-black text-slate-800">{foundCoil.diameter} mm</p>
                  </div>
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Peso Bruto</p>
                    <p className="text-xl font-black text-slate-800">{foundCoil.weight} kg</p>
                  </div>
                </div>
              </div>

              <div className="w-full space-y-8">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">1. Turno Selecionado</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['1', '2', '3'].map(shift => (
                      <button
                        key={shift}
                        onClick={() => setSelectedShift(shift as any)}
                        className={cn(
                          "py-4 rounded-2xl font-black text-xl border-2 transition-all active:scale-95",
                          selectedShift === shift 
                            ? "bg-slate-900 border-slate-900 text-white shadow-xl" 
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        )}
                      >
                        T-{shift}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 mt-2 ml-1 italic">* Selecionado automaticamente pelo horário atual.</p>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">2. Linha de Destino</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {lines.filter(l => l.active).map(line => (
                      <button
                        key={line.id}
                        onClick={() => {
                          setSelectedLine(line.id);
                          setSelectedEquipment('');
                        }}
                        className={cn(
                          "py-5 rounded-2xl font-black text-lg border-2 transition-all active:scale-95",
                          selectedLine === line.id 
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-100" 
                            : "bg-white border-slate-200 text-slate-600 hover:border-emerald-200"
                        )}
                      >
                        {line.name}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedLine && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <label className="block text-xs font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">3. Equipamento de Consumo</label>
                    <div className="grid grid-cols-2 gap-3">
                      {equipmentOptions.length > 0 ? equipmentOptions.map(equipment => (
                        <button
                          key={equipment}
                          onClick={() => setSelectedEquipment(equipment)}
                          className={cn(
                            "py-5 rounded-2xl font-black text-lg border-2 transition-all active:scale-95",
                            selectedEquipment === equipment 
                              ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-100" 
                              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                          )}
                        >
                          {equipment}
                        </button>
                      )) : (
                        <div className="col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                          <p className="text-xs font-bold text-slate-400 italic">Sem equipamentos compatíveis para esta linha/bitola.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    onClick={() => {
                      setFoundCoil(null);
                      setSelectedEquipment('');
                    }}
                    className="order-2 sm:order-1 flex-1 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black transition-all hover:bg-slate-200 active:scale-95"
                  >
                    Trocar Bobina
                  </button>
                  <button
                    onClick={() => handleConsume()}
                    disabled={!selectedLine || !selectedShift || !selectedEquipment || loading}
                    className="order-1 sm:order-2 flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3"
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                      <>
                        <CheckCircle2 className="w-6 h-6" />
                        Confirmar Consumo
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent History Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <History className="w-4 h-4" />
            Resumo do Consumo Diário
          </h3>
        </div>

        <div className="space-y-8">
          {dailySummary.map(([dateKey, group]) => (
            <div key={dateKey} className="space-y-3">
              {/* Day Header */}
              <div className="flex items-end justify-between px-6 mb-2">
                 <div>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">
                      {new Date(dateKey + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}
                    </p>
                    <h4 className="text-2xl font-black text-slate-900 tracking-tight">
                      {new Date(dateKey + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                    </h4>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total do Dia</p>
                    <p className="text-2xl font-black text-slate-900 leading-none">
                      {group.totalWeight.toLocaleString()} <span className="text-sm text-slate-400">kg</span>
                    </p>
                 </div>
              </div>

              {/* Diameter Breakdown */}
              <div className="flex flex-wrap gap-2 px-6 pb-4 border-b border-slate-100 italic">
                {Object.entries(group.byDiameter).sort((a, b) => Number(a[0]) - Number(b[0])).map(([dia, weight]) => (
                  <span key={dia} className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                    {dia}mm: <span className="text-slate-900">{weight.toLocaleString()}kg</span>
                  </span>
                ))}
                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                  {group.items.length} bobinas
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {group.items.map((coil) => (
                  <motion.div
                    layout
                    key={coil.id}
                    className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between gap-4 group hover:border-emerald-200 transition-all"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                        <Barcode className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-black text-slate-900 tracking-tight">{coil.coilNumber}</span>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 rounded">{coil.diameter}mm</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "text-[9px] font-black px-1.5 py-0.5 rounded flex items-center justify-center",
                                coil.consumedShift === '1' ? "bg-amber-100 text-amber-700" :
                                coil.consumedShift === '2' ? "bg-blue-100 text-blue-700" :
                                "bg-indigo-100 text-indigo-700"
                              )}>
                                T-{coil.consumedShift || '?'}
                              </span>
                            </div>
                           <div className="flex items-center gap-1.5">
                             <Factory className="w-3 h-3 text-emerald-500" />
                             <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                               {coil.consumedIn || 'N/A'} • {lines.find(l => l.id === coil.currentLineId)?.name || 'N/A'}
                             </span>
                           </div>
                           <div className="flex items-center gap-1.5">
                             <Clock className="w-3 h-3 text-slate-400" />
                             <span className="text-[10px] font-bold text-slate-400 uppercase">
                               {coil.consumedAt ? new Date((coil.consumedAt.seconds || 0) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                             </span>
                           </div>
                           {coil.consumedBy && (
                             <div className="flex items-center gap-1.5 opacity-30 group-hover:opacity-100 transition-opacity">
                               <Users className="w-3 h-3" />
                               <span className="text-[9px] font-bold text-slate-500 truncate max-w-[80px]">{coil.consumedBy.split(' ')[0]}</span>
                             </div>
                           )}
                        </div>
                      </div>
                    </div>

                    {isEditable(coil) && (
                      <button
                        onClick={() => {
                          setEditingCoil(coil);
                          setNewSelectedLine(coil.currentLineId || '');
                          setNewSelectedShift(coil.consumedShift as any || '');
                          setNewSelectedEquipment(coil.consumedIn || '');
                          setNewSelectedGroup(coil.consumedByGroup || '');
                        }}
                        className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all border border-transparent active:scale-95"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))}

          {dailySummary.length === 0 && (
            <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
               <History className="w-8 h-8 text-slate-300 mx-auto mb-3" />
               <p className="text-slate-400 font-bold text-xs">Nenhum consumo registrado recentemente.</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showGroupWarning && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Aviso de Escala</h3>
              <p className="text-slate-500 font-medium mb-8">
                Sua letra (<span className="font-black text-slate-900">{profile?.group}</span>) não é a letra escalada para o <span className="font-black text-slate-900">Turno {selectedShift}</span> agora.
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowGroupWarning(false)}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                >
                  Corrigir perfil/turno
                </button>
                <button
                  onClick={() => {
                    setShowGroupWarning(false);
                    handleConsume(true);
                  }}
                  className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Confirmar mesmo assim
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {editingCoil && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                    <Edit2 className="w-8 h-8 text-blue-500" />
                    Corrigir Linha
                  </h3>
                  <p className="text-slate-500 font-bold text-sm mt-1">{editingCoil.coilNumber}</p>
                </div>
                <button 
                  onClick={() => setEditingCoil(null)} 
                  className="p-2 hover:bg-slate-100 rounded-full"
                >
                  <X className="w-7 h-7 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-4 ml-1 tracking-widest">Turno & Letra</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid grid-cols-3 gap-2">
                      {['1', '2', '3'].map(shift => (
                        <button
                          key={shift}
                          onClick={() => setNewSelectedShift(shift as any)}
                          className={cn(
                            "py-3 rounded-xl font-black text-lg border-2 transition-all active:scale-95",
                            newSelectedShift === shift 
                              ? "bg-blue-600 border-blue-600 text-white shadow-lg" 
                              : "bg-white border-slate-200 text-slate-600 hover:border-blue-200"
                          )}
                        >
                          T{shift}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                       <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <select
                        value={newSelectedGroup}
                        onChange={(e) => setNewSelectedGroup(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-black focus:border-blue-500 outline-none appearance-none transition-all shadow-sm"
                       >
                         <option value="-">Letra -</option>
                         <option value="A">Letra A</option>
                         <option value="B">Letra B</option>
                         <option value="C">Letra C</option>
                         <option value="D">Letra D</option>
                         <option value="E">Letra E</option>
                       </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-4 ml-1 tracking-widest">Nova Linha de Produção</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {lines.filter(l => l.active).map(line => (
                      <button
                        key={line.id}
                        onClick={() => setNewSelectedLine(line.id)}
                        className={cn(
                          "py-4 rounded-xl font-black text-base border-2 transition-all active:scale-95",
                          newSelectedLine === line.id 
                            ? "bg-blue-600 border-blue-600 text-white shadow-lg" 
                            : "bg-white border-slate-200 text-slate-600 hover:border-blue-200"
                        )}
                      >
                        {line.name}
                      </button>
                    ))}
                  </div>
                </div>

                {newSelectedLine && editingCoil && (
                  <div className="mt-6">
                  <label className="block text-xs font-black text-slate-400 uppercase mb-4 ml-1 tracking-widest">3. Corrigir Equipamento</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(editingCoil.diameter < 3.0 
                        ? ['Amarradeira 1', 'Amarradeira 2'] 
                        : (lines.find(l => l.id === newSelectedLine)?.name?.toLowerCase().includes('linha a') || lines.find(l => l.id === newSelectedLine)?.name?.toLowerCase().includes('linha b')
                          ? ['Unitizadora', 'Big Balé']
                          : ['Unitizadora'])
                      ).map(equip => (
                        <button
                          key={equip}
                          onClick={() => setNewSelectedEquipment(equip)}
                          className={cn(
                            "py-4 rounded-xl font-black text-sm border-2 transition-all active:scale-95",
                            newSelectedEquipment === equip 
                              ? "bg-blue-600 border-blue-600 text-white shadow-lg" 
                              : "bg-white border-slate-200 text-slate-600 hover:border-blue-200"
                          )}
                        >
                          {equip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                   <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                   <p className="text-[11px] font-bold text-amber-700 leading-tight">
                     Dúvida? Verifique fisicamente a linha onde a bobina se encontra antes de salvar a correção.
                   </p>
                </div>
              </div>

              <div className="p-8 bg-slate-50 flex gap-4">
                <button
                  type="button"
                  onClick={() => setEditingCoil(null)}
                  className="flex-1 py-5 bg-white text-slate-600 rounded-2xl font-black border border-slate-200 hover:bg-slate-100 transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditCorrection}
                  disabled={loading || !newSelectedLine || !newSelectedShift}
                  className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
                >
                   {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                      <>
                        <Save className="w-6 h-6" />
                        Salvar Correção
                      </>
                   )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
