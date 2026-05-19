import React, { useState, useEffect } from 'react';
import { 
  collection, 
  updateDoc, 
  doc, 
  deleteDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { WireBatch, WireCoil, WireSupplier, ProductionLine } from '../../types';
import { 
  History, 
  Search, 
  Calendar, 
  Truck, 
  FileText, 
  Weight, 
  Edit2, 
  Trash2, 
  X, 
  Check,
  ChevronRight,
  Package,
  Save,
  Loader2,
  User,
  Barcode,
  Clock,
  Factory
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { ConfirmationModal } from '../ui/ConfirmationModal';

interface HistoryTabProps {
  batches: WireBatch[];
  suppliers: WireSupplier[];
  lines: ProductionLine[];
  isAdmin: boolean;
  isManager: boolean;
  startDate: string;
  endDate: string;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ 
  batches, 
  suppliers, 
  lines, 
  isAdmin,
  isManager,
  startDate,
  endDate
}) => {
  const [viewMode, setViewMode] = useState<'batches' | 'consumptions'>('batches');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDiameter, setFilterDiameter] = useState<string>('');
  const [consumptionHistory, setConsumptionHistory] = useState<WireCoil[]>([]);
  const [editingBatch, setEditingBatch] = useState<WireBatch | null>(null);
  const [editingCoil, setEditingCoil] = useState<WireCoil | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<WireCoil[] | null>(null);
  const [isViewingDetails, setIsViewingDetails] = useState<string | null>(null);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onConfirm?: () => void;
    showConfirmButton?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  const fetchConsumptions = async () => {
    setLoading(true);
    try {
      let q = query(
        collection(db, 'wire_coils'), 
        where('status', '==', 'consumed'),
        orderBy('consumedAt', 'desc')
      );

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        q = query(q, where('consumedAt', '>=', start));
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        q = query(q, where('consumedAt', '<=', end));
      }

      if (!startDate && !endDate) {
        q = query(q, limit(50));
      }

      const snap = await getDocs(q);
      const coils = snap.docs.map(d => ({ id: d.id, ...d.data() } as WireCoil));
      setConsumptionHistory(coils);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'consumptions') {
      fetchConsumptions();
    }
  }, [viewMode, startDate, endDate]);

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = batch.nfNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (startDate || endDate) {
      const batchDate = new Date(batch.date);
      if (startDate && batchDate < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (batchDate > end) return false;
      }
    }

    return true;
  });

  const filteredConsumptions = consumptionHistory.filter(coil => {
    const matchesSearch = coil.coilNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (coil.consumedBy || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDiameter = !filterDiameter || coil.diameter.toString() === filterDiameter;
    return matchesSearch && matchesDiameter;
  });

  const handleEditBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;

    setLoading(true);
    try {
      const supplierName = suppliers.find(s => s.id === editingBatch.supplierId)?.name || editingBatch.supplierName;
      await updateDoc(doc(db, 'wire_batches', editingBatch.id), {
        nfNumber: editingBatch.nfNumber,
        date: editingBatch.date,
        supplierId: editingBatch.supplierId,
        supplierName
      });
      setEditingBatch(null);
      setModalConfig({
        isOpen: true,
        title: 'Sucesso!',
        message: 'Lançamento atualizado com sucesso!',
        type: 'success'
      });
    } catch (err) {
      console.error(err);
      setModalConfig({
        isOpen: true,
        title: 'Erro',
        message: 'Erro ao atualizar lançamento.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditCoil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoil) return;

    setLoading(true);
    try {
      const updateData: any = {
        diameter: editingCoil.diameter,
        weight: editingCoil.weight,
        coilNumber: editingCoil.coilNumber
      };

      if (editingCoil.consumedIn) {
        updateData.consumedIn = editingCoil.consumedIn;
      }

      await updateDoc(doc(db, 'wire_coils', editingCoil.id), updateData);
      
      // Update local state for the details view if it's open
      if (selectedBatchDetails) {
        setSelectedBatchDetails(prev => 
          prev ? prev.map(c => c.id === editingCoil.id ? editingCoil : c) : null
        );
      }

      setEditingCoil(null);
      setModalConfig({
        isOpen: true,
        title: 'Sucesso!',
        message: 'Bobina atualizada com sucesso!',
        type: 'success'
      });
    } catch (err) {
      console.error(err);
      setModalConfig({
        isOpen: true,
        title: 'Erro',
        message: 'Erro ao atualizar bobina.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchDetails = async (batchId: string) => {
    if (isViewingDetails === batchId) {
      setIsViewingDetails(null);
      setSelectedBatchDetails(null);
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, 'wire_coils'), where('batchId', '==', batchId));
      const snap = await getDocs(q);
      const coils = snap.docs.map(d => ({ id: d.id, ...d.data() } as WireCoil));
      setSelectedBatchDetails(coils);
      setIsViewingDetails(batchId);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBatch = async (batch: WireBatch) => {
    setModalConfig({
      isOpen: true,
      title: 'Confirmar Exclusão',
      message: `ATENÇÃO: Isso excluirá a NF ${batch.nfNumber} e TODAS as suas bobinas. Deseja continuar?`,
      type: 'warning',
      showConfirmButton: true,
      onConfirm: () => executeDeleteBatch(batch)
    });
  };

  const executeDeleteBatch = async (batch: WireBatch) => {
    setLoading(true);
    try {
      // 1. Delete all coils associated with this batch
      const q = query(collection(db, 'wire_coils'), where('batchId', '==', batch.id));
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, 'wire_coils', d.id)));
      await Promise.all(deletePromises);

      // 2. Delete the batch document
      await deleteDoc(doc(db, 'wire_batches', batch.id));
      
      setModalConfig({
        isOpen: true,
        title: 'Excluído',
        message: 'Lançamento e bobinas excluídos com sucesso.',
        type: 'success'
      });
    } catch (err) {
      console.error(err);
      setModalConfig({
        isOpen: true,
        title: 'Erro',
        message: 'Erro ao excluir lançamento.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Toggle */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-none">Histórico de Movimentação</h2>
              <p className="text-slate-500 text-sm font-medium mt-1">Consulte recebimentos e consumos registrados</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => { setViewMode('batches'); setSearchTerm(''); }}
              className={cn(
                "px-6 py-2.5 rounded-[1.25rem] text-xs font-black uppercase transition-all",
                viewMode === 'batches' ? "bg-white text-blue-600 shadow-md" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Recebimento (NF)
            </button>
            <button
              onClick={() => { setViewMode('consumptions'); setSearchTerm(''); }}
              className={cn(
                "px-6 py-2.5 rounded-[1.25rem] text-xs font-black uppercase transition-all",
                viewMode === 'consumptions' ? "bg-white text-emerald-600 shadow-md" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Consumo (Linhas)
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={viewMode === 'batches' ? "Buscar por NF ou Fornecedor..." : "Buscar por ID da Bobina ou Usuário..."}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold placeholder:text-slate-300 transition-all"
            />
          </div>
          
          {viewMode === 'consumptions' && (
            <div className="relative sm:w-48">
              <Weight className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select
                value={filterDiameter}
                onChange={(e) => setFilterDiameter(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold appearance-none text-slate-700"
              >
                <option value="">Todas Bitolas</option>
                {Array.from(new Set(consumptionHistory.map(c => c.diameter))).sort((a,b) => Number(a)-Number(b)).map(d => (
                  <option key={d} value={d.toString()}>{d} mm</option>
                ))}
              </select>
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Batch List (Recebimento) */}
      {viewMode === 'batches' && (
        <div className="grid grid-cols-1 gap-4">
          {filteredBatches.map(batch => (
            <motion.div
              layout
              key={`batch-${batch.id}`}
              className={cn(
                "bg-white border rounded-[2rem] transition-all overflow-hidden",
                isViewingDetails === batch.id ? "border-blue-500 shadow-xl shadow-blue-50" : "border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-wrap items-center gap-6 md:gap-12">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Nota Fiscal
                    </p>
                    <p className="text-lg font-black text-slate-900"># {batch.nfNumber}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Truck className="w-3 h-3" /> Fornecedor
                    </p>
                    <p className="text-lg font-black text-slate-900 tracking-tight">{batch.supplierName}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Data
                    </p>
                    <p className="text-lg font-black text-slate-900">{new Date(batch.date).toLocaleDateString('pt-BR')}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Weight className="w-3 h-3" /> Peso Total
                    </p>
                    <p className="text-lg font-black text-blue-600">{batch.totalWeight.toLocaleString()} kg</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <User className="w-3 h-3" /> Responsável
                    </p>
                    <p className="text-sm font-black text-slate-500 uppercase">{batch.responsibleName || 'Sistema'}</p>
                  </div>
                </div>

                  <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchBatchDetails(batch.id)}
                    className={cn(
                      "px-4 py-3 rounded-xl font-black text-sm flex items-center gap-2 transition-all",
                      isViewingDetails === batch.id ? "bg-blue-600 text-white shadow-lg" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    <Package className="w-4 h-4" />
                    {batch.coilsCount} Bobinas
                  </button>
                  
                  {(isAdmin || isManager) && (
                    <>
                      <button
                        onClick={() => setEditingBatch(batch)}
                        className="p-3 text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-100 transition-all border border-amber-100"
                        title="Editar NF"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(batch)}
                        className="p-3 text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100 transition-all border border-rose-100"
                        title="Excluir Lançamento"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Expansible Details */}
              <AnimatePresence>
                {isViewingDetails === batch.id && selectedBatchDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-slate-50 border-t border-slate-100 p-6 md:p-8"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {selectedBatchDetails.map((coil, idx) => (
                        <div key={`detail-${coil.id}-${idx}`} className="group bg-white p-3 rounded-2xl border border-slate-200 shadow-sm relative">
                          {(isAdmin || isManager) && (
                            <button
                              onClick={() => setEditingCoil(coil)}
                              className="absolute -top-2 -right-2 p-1.5 bg-amber-100 text-amber-600 rounded-lg shadow-sm z-10 transition-all active:scale-95"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                          <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-2">Bobina {idx + 1}</p>
                          <p className="font-black text-slate-900 text-xs mb-1 truncate">{coil.coilNumber}</p>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                             <div className="flex flex-col">
                               <span className="text-[10px] font-bold text-slate-500">{coil.weight}kg</span>
                               <span className="text-[8px] font-black text-blue-500">{coil.diameter}mm</span>
                             </div>
                             <span className={cn(
                               "text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase self-end",
                               coil.status === 'consumed' ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                             )}>
                               {coil.status === 'consumed' ? 'Consumida' : 'Estoque'}
                             </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}

          {filteredBatches.length === 0 && (
            <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
               <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
               <p className="text-slate-500 font-bold">Nenhum lançamento encontrado para sua busca.</p>
            </div>
          )}
        </div>
      )}

      {/* Consumption History View */}
      {viewMode === 'consumptions' && (
        <div className="grid grid-cols-1 gap-4">
          {filteredConsumptions.map(coil => (
            <motion.div
              layout
              key={`consumption-${coil.id}`}
              className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="flex flex-wrap items-center gap-6 md:gap-12">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Barcode className="w-3 h-3" /> ID da Bobina
                  </p>
                  <p className="text-lg font-black text-slate-900">{coil.coilNumber}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Factory className="w-3 h-3" /> Linha
                  </p>
                  <p className="text-lg font-black text-slate-900 tracking-tight">
                    {lines.find(l => l.id === coil.currentLineId)?.name || 'N/A'}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Horário
                  </p>
                  <p className="text-lg font-black text-slate-900">
                    {coil.consumedAt ? new Date(coil.consumedAt.seconds * 1000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '---'}
                  </p>
                </div>

                <div className="space-y-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Package className="w-3 h-3" /> Turno
                  </p>
                  <span className={cn(
                    "inline-block px-3 py-1 rounded-lg text-xs font-black",
                    coil.consumedShift === '1' ? "bg-amber-100 text-amber-700" :
                    coil.consumedShift === '2' ? "bg-blue-100 text-blue-700" :
                    "bg-indigo-100 text-indigo-700"
                  )}>
                    TURNO {coil.consumedShift || '?'}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <User className="w-3 h-3" /> Usuário
                  </p>
                  <p className="text-sm font-black text-slate-500 uppercase truncate max-w-[120px]">{coil.consumedBy || 'Sistema'}</p>
                </div>
              </div>
            </motion.div>
          ))}

          {filteredConsumptions.length === 0 && (
            <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
               <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
               <p className="text-slate-500 font-bold">Nenhum consumo encontrado para sua busca.</p>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        showConfirmButton={modalConfig.showConfirmButton}
        onConfirm={modalConfig.onConfirm}
        confirmText={modalConfig.showConfirmButton ? "Sim, Prosseguir" : "Entendido"}
      />

      <AnimatePresence>
        {editingCoil && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleEditCoil}>
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                    <Edit2 className="w-8 h-8 text-amber-500" />
                    Editar Bobina
                  </h3>
                  <button type="button" onClick={() => setEditingCoil(null)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="w-7 h-7 text-slate-400" />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">ID da Bobina</label>
                    <input
                      required
                      type="text"
                      value={editingCoil.coilNumber}
                      onChange={(e) => setEditingCoil({...editingCoil, coilNumber: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Bitola (mm)</label>
                      <select
                        required
                        value={editingCoil.diameter}
                        onChange={(e) => setEditingCoil({...editingCoil, diameter: parseFloat(e.target.value)})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-lg appearance-none"
                      >
                        <option value="2.18">2.18 mm</option>
                        <option value="2.3">2.30 mm</option>
                        <option value="3.0">3.00 mm</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Peso (kg)</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        value={editingCoil.weight || ''}
                        onChange={(e) => setEditingCoil({...editingCoil, weight: parseFloat(e.target.value)})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-lg"
                      />
                    </div>
                  </div>

                  {editingCoil.status === 'consumed' && (
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">3. Equipamento (Consumo)</label>
                      <div className="grid grid-cols-2 gap-3">
                        {(editingCoil.diameter < 3.0 
                          ? ['Amarradeira 1', 'Amarradeira 2'] 
                          : (lines.find(l => l.id === editingCoil.currentLineId)?.name?.toLowerCase().includes('linha a') || lines.find(l => l.id === editingCoil.currentLineId)?.name?.toLowerCase().includes('linha b')
                            ? ['Unitizadora', 'Big Balé']
                            : ['Unitizadora'])
                        ).map(equip => (
                          <button
                            key={equip}
                            type="button"
                            onClick={() => setEditingCoil({...editingCoil, consumedIn: equip})}
                            className={cn(
                              "py-3 rounded-xl font-black text-xs border-2 transition-all active:scale-95",
                              editingCoil.consumedIn === equip 
                                ? "bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-100" 
                                : "bg-white border-slate-200 text-slate-600 hover:border-amber-200"
                            )}
                          >
                            {equip}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-8 bg-slate-50 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setEditingCoil(null)}
                    className="flex-1 py-4 bg-white text-slate-600 rounded-2xl font-black border border-slate-200 hover:bg-slate-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3"
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                      <>
                        <Save className="w-6 h-6" />
                        Salvar Bobina
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {editingBatch && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleEditBatch}>
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                    <Edit2 className="w-8 h-8 text-amber-500" />
                    Editar Lançamento
                  </h3>
                  <button type="button" onClick={() => setEditingBatch(null)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="w-7 h-7 text-slate-400" />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Número da NF</label>
                    <input
                      required
                      type="text"
                      value={editingBatch.nfNumber}
                      onChange={(e) => setEditingBatch({...editingBatch, nfNumber: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Fornecedor</label>
                    <select
                      required
                      value={editingBatch.supplierId}
                      onChange={(e) => setEditingBatch({...editingBatch, supplierId: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-lg appearance-none"
                    >
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Data do Recebimento</label>
                    <input
                      required
                      type="date"
                      value={editingBatch.date}
                      onChange={(e) => setEditingBatch({...editingBatch, date: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-lg"
                    />
                  </div>
                </div>

                <div className="p-8 bg-slate-50 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setEditingBatch(null)}
                    className="flex-1 py-4 bg-white text-slate-600 rounded-2xl font-black border border-slate-200 hover:bg-slate-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3"
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                      <>
                        <Save className="w-6 h-6" />
                        Salvar Alterações
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
