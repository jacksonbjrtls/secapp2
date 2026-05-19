import React, { useState } from 'react';
import { 
  collection, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { WireBatch, WireCoil, WireSupplier } from '../../types';
import { 
  PackagePlus, 
  X, 
  Loader2, 
  Save, 
  Barcode, 
  AlertTriangle, 
  Weight, 
  Factory, 
  Trash2, 
  Plus,
  Camera,
  Keyboard,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { parseWireQRCode } from '../../lib/wireUtils';
import { QRCameraScanner } from './QRCameraScanner';
import { ConfirmationModal } from '../ui/ConfirmationModal';

import { useAuth } from '../../hooks/useAuth';

interface ReceivingTabProps {
  suppliers: WireSupplier[];
  isManager: boolean;
}

export const ReceivingTab: React.FC<ReceivingTabProps> = ({ suppliers, isManager }) => {
  const { profile } = useAuth();
  const [currentBatch, setCurrentBatch] = useState<Partial<WireBatch> | null>(null);
  const [scannedCoils, setScannedCoils] = useState<Partial<WireCoil>[]>([]);
  const [qrInput, setQrInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualData, setManualData] = useState({ coilNumber: '', weight: '', diameter: 2.30 });
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const startNewBatch = () => {
    if (!isManager) return;
    setCurrentBatch({
      nfNumber: '',
      supplierId: '',
      supplierName: '',
      date: new Date().toISOString().split('T')[0],
      status: 'open',
      totalWeight: 0,
      coilsCount: 0
    });
    setScannedCoils([]);
  };

  const processScanData = (data: string) => {
    if (!currentBatch?.supplierId) {
      setError('Selecione primeiro o fornecedor da carga no formulário ao lado.');
      return;
    }

    const parsed = parseWireQRCode(data);
    if (!parsed) {
      setError('Formato de código não reconhecido. Verifique se o QR code é de um fornecedor homologado.');
      return;
    }

    // Business Rule: Check if the scanned coil belongs to the selected supplier
    const selectedSupplier = suppliers.find(s => s.id === currentBatch.supplierId);
    if (!selectedSupplier) return;

    const supplierMatch = parsed.supplier.toLowerCase().trim() === selectedSupplier.name.toLowerCase().trim();
    
    if (!supplierMatch) {
      setError(`Erro de Fornecedor: Esta bobina é da ${parsed.supplier}, mas você selecionou ${selectedSupplier.name}. Todas as bobinas de uma carga devem ser do mesmo fornecedor.`);
      return;
    }

    if (scannedCoils.some(c => c.coilNumber === parsed.coilNumber)) {
      setError('Esta bobina já foi bipada nesta carga.');
      return;
    }

    const newCoil: Partial<WireCoil> = {
      coilNumber: parsed.coilNumber,
      diameter: parsed.diameter,
      weight: parsed.weight,
      supplierId: currentBatch.supplierId,
      status: 'received',
      receivedAt: new Date().toISOString(),
      isDamaged: false
    };

    setScannedCoils(prev => [newCoil, ...prev]);
    setQrInput('');
    setError('');
    
    // Auto-focus back to input for next scan if manually typing
    const input = document.querySelector('input[placeholder*="Bipe"]') as HTMLInputElement;
    if (input) input.focus();
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrInput) return;
    processScanData(qrInput);
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualData.coilNumber || !manualData.weight) {
      setError('Preencha o número e o peso da bobina.');
      return;
    }

    const manualCoil: Partial<WireCoil> = {
      coilNumber: manualData.coilNumber,
      diameter: manualData.diameter,
      weight: parseFloat(manualData.weight.toString()),
      status: 'received',
      receivedAt: new Date().toISOString(),
      isDamaged: true
    };
    setScannedCoils(prev => [manualCoil, ...prev]);
    setShowManualModal(false);
    setManualData({ coilNumber: '', weight: '', diameter: 2.30 });
    setError('');
  };

  const updateCoil = (index: number, fields: Partial<WireCoil>) => {
    setScannedCoils(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...fields };
      return copy;
    });
  };

  const removeCoil = (index: number) => {
    setScannedCoils(prev => prev.filter((_, i) => i !== index));
  };

  const saveBatch = async () => {
    if (!currentBatch?.nfNumber || !currentBatch?.supplierId || scannedCoils.length === 0) {
      setError('Preencha os dados da NF, Fornecedor e bipe ao menos uma bobina.');
      return;
    }

    const unweightedCoils = scannedCoils.filter(c => !c.weight || c.weight <= 0);
    if (unweightedCoils.length > 0) {
      setError('Existem bobinas com peso zero. Verifique as bobinas manuais/danificadas.');
      return;
    }

    setLoading(true);
    try {
      const supplierName = suppliers.find(s => s.id === currentBatch.supplierId)?.name || '';
      const totalWeight = scannedCoils.reduce((acc, c) => acc + (c.weight || 0), 0);

      const batchRef = await addDoc(collection(db, 'wire_batches'), {
        ...currentBatch,
        supplierName,
        totalWeight,
        coilsCount: scannedCoils.length,
        createdAt: serverTimestamp(),
        responsibleName: profile?.displayName || profile?.email || 'Sistema',
        status: 'closed'
      });

      for (const coil of scannedCoils) {
        await addDoc(collection(db, 'wire_coils'), {
          ...coil,
          batchId: batchRef.id,
          supplierId: currentBatch.supplierId
        });
      }

      setCurrentBatch(null);
      setScannedCoils([]);
      setShowSuccessModal(true);
    } catch (err) {
      console.error(err);
      setError('Erro ao salvar recebimento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {isCameraOpen && (
        <QRCameraScanner 
          onScan={processScanData} 
          onClose={() => setIsCameraOpen(false)} 
        />
      )}

      <ConfirmationModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Sucesso!"
        message="Recebimento finalizado com sucesso!"
        type="success"
      />

      <AnimatePresence>
        {showManualModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleManualAdd}>
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                    <Keyboard className="w-8 h-8 text-emerald-500" />
                    Entrada Manual
                  </h3>
                  <button type="button" onClick={() => setShowManualModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="w-7 h-7 text-slate-400" />
                  </button>
                </div>

                <div className="p-8 space-y-5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">ID / Número da Bobina</label>
                    <input
                      required
                      type="text"
                      value={manualData.coilNumber}
                      onChange={(e) => setManualData({...manualData, coilNumber: e.target.value})}
                      placeholder="Ex: 1060..."
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Peso (kg)</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        value={manualData.weight}
                        onChange={(e) => setManualData({...manualData, weight: e.target.value})}
                        placeholder="0.00"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Bitola (mm)</label>
                      <select
                        required
                        value={manualData.diameter}
                        onChange={(e) => setManualData({...manualData, diameter: parseFloat(e.target.value)})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg appearance-none"
                      >
                        <option value="2.18">2.18 mm</option>
                        <option value="2.3">2.30 mm</option>
                        <option value="3.0">3.00 mm</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-slate-50 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    className="flex-1 py-4 bg-white text-slate-600 rounded-2xl font-black border border-slate-200 hover:bg-slate-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all"
                  >
                    Adicionar Bobina
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!currentBatch ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
          <PackagePlus className="w-16 h-16 text-slate-300 mb-4" />
          <h3 className="text-xl font-bold text-slate-800 mb-2">Iniciar Novo Recebimento</h3>
          <p className="text-slate-500 mb-6 text-center max-w-sm">Use esta função para registrar a chegada de uma nova carga de arames.</p>
          <button
            onClick={startNewBatch}
            className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
          >
            Começar Recebimento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Batch Info Form */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm sticky top-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Dados da Carga</h3>
                <button onClick={() => setCurrentBatch(null)} className="p-3 text-slate-400 hover:text-rose-500 rounded-xl transition-all">
                  <X className="w-7 h-7" />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Número da NF</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={currentBatch.nfNumber}
                    onChange={(e) => setCurrentBatch({...currentBatch, nfNumber: e.target.value})}
                    placeholder="Ex: 123456"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Fornecedor</label>
                  <select
                    disabled={scannedCoils.length > 0}
                    value={currentBatch.supplierId}
                    onChange={(e) => setCurrentBatch({...currentBatch, supplierId: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg appearance-none disabled:opacity-70 disabled:bg-slate-100"
                  >
                    <option value="">Selecione...</option>
                    {suppliers.filter(s => s.active).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {scannedCoils.length > 0 && (
                    <p className="text-[9px] font-bold text-amber-600 mt-2 ml-1 uppercase">Fornecedor travado (bobinas já bipadas)</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Data do Recebimento</label>
                  <input
                    type="date"
                    value={currentBatch.date}
                    onChange={(e) => setCurrentBatch({...currentBatch, date: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg"
                  />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Resumo da Carga</span>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Bobinas</p>
                    <p className="text-2xl font-black text-emerald-700">{scannedCoils.length}</p>
                  </div>
                  <div className="flex-1 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-black text-blue-600 uppercase mb-1">Total (kg)</p>
                    <p className="text-2xl font-black text-blue-700">
                      {scannedCoils.reduce((acc, c) => acc + (c.weight || 0), 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={saveBatch}
                disabled={loading || scannedCoils.length === 0}
                className="w-full mt-8 bg-slate-900 text-white py-5 rounded-2xl font-black shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:grayscale"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                  <>
                    <Save className="w-6 h-6" />
                    Finalizar Recebimento
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Scanner and Coil List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border-2 border-emerald-500 shadow-xl shadow-emerald-50 relative overflow-hidden">
               <div className="relative z-10">
                 <div className="flex items-center justify-between mb-6">
                   <h3 className="text-xl font-black text-slate-900 tracking-tight">Captura</h3>
                   <div className="flex gap-2">
                     <button 
                        onClick={() => setIsCameraOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                     >
                       <Camera className="w-5 h-5" />
                       Ligar Câmera
                     </button>
                     <button 
                        onClick={() => {
                          if (!currentBatch?.supplierId) {
                            setError('Selecione primeiro o fornecedor da carga.');
                            return;
                          }
                          setShowManualModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-emerald-100 text-emerald-700 rounded-xl text-sm font-black active:scale-95 transition-all"
                     >
                       <Keyboard className="w-5 h-5" />
                       Manual
                     </button>
                   </div>
                 </div>
                 
                 <form onSubmit={handleScanSubmit} className="flex gap-2">
                   <input
                     autoFocus
                     type="text"
                     value={qrInput}
                     onChange={(e) => setQrInput(e.target.value)}
                     placeholder="Bipe com leitor USB ou digite..."
                     className="flex-1 px-6 py-5 bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl text-xl font-mono outline-none transition-all placeholder:font-sans placeholder:text-sm shadow-inner"
                   />
                 </form>
                 
                 {error && (
                   <motion.p 
                     initial={{ opacity: 0, y: 5 }}
                     animate={{ opacity: 1, y: 0 }}
                     className="mt-4 p-4 bg-rose-50 rounded-xl text-sm font-bold text-rose-600 flex items-center gap-3 border border-rose-100"
                   >
                     <AlertTriangle className="w-5 h-5" /> {error}
                   </motion.p>
                 )}
               </div>
            </div>

            {/* Scanned List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Bobinas na Carga</h4>
                <span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500">{scannedCoils.length} UNIDADES</span>
              </div>
              <div className="space-y-3">
                {scannedCoils.map((coil, idx) => (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={coil.coilNumber || `manual-${idx}`}
                    className={cn(
                      "group p-5 bg-white rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between transition-all active:bg-slate-50",
                      coil.isDamaged && "border-amber-200 bg-amber-50/50 shadow-amber-50 ring-2 ring-amber-100/50"
                    )}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center font-black",
                        coil.isDamaged ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                      )}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {coil.isDamaged ? (
                            <input
                              type="text"
                              value={coil.coilNumber}
                              onChange={(e) => updateCoil(idx, { coilNumber: e.target.value })}
                              className="font-black text-slate-900 bg-transparent border-b border-amber-200 outline-none w-40"
                              placeholder="ID da Bobina"
                            />
                          ) : (
                            <p className="font-black text-slate-900 tracking-tight">{coil.coilNumber}</p>
                          )}
                          {coil.isDamaged && (
                            <span className="text-[8px] bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase font-black">Dados Manuais</span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-6 mt-2">
                          <div className="flex items-center gap-2">
                            <Weight className="w-3.5 h-3.5 text-slate-400" />
                            {coil.isDamaged ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={coil.weight || ''}
                                  onChange={(e) => updateCoil(idx, { weight: parseFloat(e.target.value) })}
                                  placeholder="Peso"
                                  className="w-20 px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-xs font-bold font-mono outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                                <span className="text-[10px] text-slate-400 font-bold">kg</span>
                              </div>
                            ) : (
                              <span className="text-xs font-black text-slate-600">{coil.weight} kg</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Factory className="w-3.5 h-3.5 text-slate-400" />
                            {coil.isDamaged ? (
                              <select
                                value={coil.diameter}
                                onChange={(e) => updateCoil(idx, { diameter: parseFloat(e.target.value) })}
                                className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500"
                              >
                                <option value="2.18">2.18 mm</option>
                                <option value="2.3">2.30 mm</option>
                                <option value="3.0">3.00 mm</option>
                              </select>
                            ) : (
                              <span className="text-xs font-black text-slate-600">{coil.diameter} mm</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => removeCoil(idx)}
                      className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </motion.div>
                ))}

                {scannedCoils.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                    <Barcode className="w-12 h-12 mb-3 opacity-20" />
                    <p className="font-bold">Aguardando bipe ou entrada manual...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
