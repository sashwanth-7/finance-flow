import { useState, useEffect } from 'react';
import { repaymentsAPI, paymentsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { HandCoins, CheckCircle, AlertTriangle, Clock, X, Phone, Lock, ExternalLink, ArrowRight } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-';

export default function CollectionPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'today';
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    const currentTabParam = searchParams.get('tab');
    if (currentTabParam && currentTabParam !== tab) {
      setTab(currentTabParam);
    }
  }, [searchParams]);

  const [payModal, setPayModal] = useState(null);
  const [payType, setPayType] = useState('INSTALLMENT'); // 'INSTALLMENT' or 'PRINCIPAL'
  const [payForm, setPayForm] = useState({ amount: '', principalAmount: '', paymentMode: 'CASH', reference: '', penaltyAmount: '', notes: '', sendSms: true });
  const [paying, setPaying] = useState(false);
  const [search, setSearch] = useState('');
  const [loanType, setLoanType] = useState('ALL');

  // Group repayments by loanId to detect blocked installments
  // An installment is blocked ONLY if an earlier installment is NOT PAID and NOT CARRIED_FORWARD
  const getBlockedMap = (list) => {
    const lowestUnpaid = {};
    list.forEach(r => {
      const loanId = r.loanId || r.loan?.id;
      if (r.status !== 'PAID' && r.status !== 'CARRIED_FORWARD') {
        if (lowestUnpaid[loanId] === undefined || r.installmentNo < lowestUnpaid[loanId]) {
          lowestUnpaid[loanId] = r.installmentNo;
        }
      }
    });
    const blocked = {};
    list.forEach(r => {
      const loanId = r.loanId || r.loan?.id;
      if (r.status !== 'PAID' && r.status !== 'CARRIED_FORWARD' && lowestUnpaid[loanId] !== undefined && r.installmentNo > lowestUnpaid[loanId]) {
        blocked[r.id] = lowestUnpaid[loanId];
      }
    });
    return blocked;
  };

  const filteredRepayments = repayments.filter(r => {
    if (loanType !== 'ALL' && r.loan?.interestType !== loanType) return false;
    if (search && !r.loan?.customer?.name?.toLowerCase().includes(search.toLowerCase()) && !r.loan?.loanNumber?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const blockedMap = getBlockedMap(repayments);

  const load = async () => {
    setLoading(true);
    try {
      const data = tab === 'today'
        ? await repaymentsAPI.today()
        : await repaymentsAPI.list({ status: 'OVERDUE', limit: 100 });
      setRepayments(data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab]);

  const handlePay = async (e) => {
    e.preventDefault();
    setPaying(true);
    try {
      if (payType === 'PRINCIPAL') {
        const loanId = payModal.loanId || payModal.loan?.id;
        if (!loanId) {
          toast.error('Loan ID not found');
          return;
        }
        const pAmount = parseFloat(payForm.principalAmount);
        if (isNaN(pAmount) || pAmount <= 0) {
          toast.error('Please enter a valid principal amount');
          return;
        }
        await paymentsAPI.collectPrincipal({
          loanId,
          amount: pAmount,
          paymentMode: payForm.paymentMode,
          reference: payForm.reference,
          notes: payForm.notes || 'Principal repayment from collection page'
        });
        toast.success('✓ Principal payment collected! Loan ledger updated.');
      } else {
        // Find earliest unpaid repayment for this loan to ensure zero API errors
        const loanId = payModal.loanId || payModal.loan?.id;
        const unpaidForLoan = repayments.filter(item => (item.loanId === loanId || item.loan?.id === loanId) && item.status !== 'PAID' && item.status !== 'CARRIED_FORWARD');
        unpaidForLoan.sort((a, b) => a.installmentNo - b.installmentNo);
        const targetRepayment = unpaidForLoan[0] || payModal;

        await paymentsAPI.collect({ 
          repaymentId: targetRepayment.id, 
          ...payForm, 
          amount: parseFloat(payForm.amount),
          penaltyAmount: parseFloat(payForm.penaltyAmount) || 0
        });
        toast.success(`✓ Payment collected for Installment #${targetRepayment.installmentNo}!`);
      }
      setPayModal(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || err.message || 'Failed'); }
    finally { setPaying(false); }
  };

  const openPay = (r) => {
    // Automatically target the earliest unpaid installment for this loan
    const loanId = r.loanId || r.loan?.id;
    const unpaidForLoan = repayments.filter(item => (item.loanId === loanId || item.loan?.id === loanId) && item.status !== 'PAID' && item.status !== 'CARRIED_FORWARD');
    unpaidForLoan.sort((a, b) => a.installmentNo - b.installmentNo);
    const targetRepayment = unpaidForLoan[0] || r;

    setPayModal(targetRepayment);
    setPayType('INSTALLMENT');
    const defaultPrincipal = targetRepayment.loan?.outstandingPrincipal ?? targetRepayment.loan?.principalAmount ?? 0;
    setPayForm({
      amount: String(targetRepayment.dueAmount - targetRepayment.paidAmount),
      principalAmount: String(defaultPrincipal),
      paymentMode: 'CASH',
      reference: '',
      penaltyAmount: '',
      notes: ''
    });
  };

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Collections</div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[['today', "Today"], ['overdue', 'Overdue']].map(([val, label]) => (
          <button key={val} className={`tab ${tab === val ? 'active' : ''}`} onClick={() => setTab(val)}>{label}</button>
        ))}
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
        <input 
          type="text" 
          placeholder="Search by name or loan number..." 
          className="form-input" 
          style={{ flex: 1 }}
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
        <select 
          className="form-select" 
          style={{ width: 'auto' }}
          value={loanType} 
          onChange={e => setLoanType(e.target.value)}
        >
          <option value="ALL">All Loan Types</option>
          <option value="FLAT">Regular Flat Interest (வட்டி கடன்)</option>
          <option value="WITHOUT_INTEREST">Deduction Based (கந்து வட்டி)</option>
          <option value="EMI">EMI (அசலோடு தவணை)</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : filteredRepayments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <CheckCircle size={40} style={{ color: 'var(--accent-400)', opacity: 0.5, marginBottom: 8 }} />
          <div style={{ fontWeight: 600 }}>All clear!</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No collections {tab === 'today' ? 'for today' : 'found'}</div>
        </div>
      ) : (
        filteredRepayments.map((r) => {
          const isBlocked = !!blockedMap[r.id];
          const blockingInstNo = blockedMap[r.id];
          const loanTargetId = r.loanId || r.loan?.id;
          return (
            <div
              key={r.id}
              className="collection-card"
              style={isBlocked ? { opacity: 0.9, background: 'var(--bg-glass, rgba(0,0,0,0.02))', border: '1.5px dashed var(--border-subtle, #cbd5e1)' } : {}}
            >
              {/* Blocked banner with direct navigation shortcuts */}
              {isBlocked && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                  background: 'rgba(244,63,94,0.08)',
                  border: '1px solid rgba(244,63,94,0.25)',
                  borderRadius: 8, padding: '8px 12px', marginBottom: 12,
                  fontSize: 11, color: '#e11d48', fontWeight: 600,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200 }}>
                    <Lock size={13} style={{ flexShrink: 0 }} />
                    <span>முதலில் Installment #{blockingInstNo} collect செய்யுங்கள் (அல்லது Carry Forward செய்யுங்கள்)</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {tab === 'today' && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setTab('overdue');
                          if (r.loan?.customer?.name) setSearch(r.loan.customer.name);
                        }}
                        style={{ fontSize: 11, padding: '3px 9px', color: '#e11d48', border: '1px solid rgba(244,63,94,0.35)', background: '#fff', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                      >
                        Overdue Tab <ArrowRight size={11} />
                      </button>
                    )}
                    {loanTargetId && (
                      <Link
                        to={`/loans/${loanTargetId}`}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, padding: '3px 9px', color: 'var(--primary-600, #4f46e5)', border: '1px solid rgba(99,102,241,0.35)', background: '#fff', borderRadius: 6, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                      >
                        Loan Details <ExternalLink size={11} />
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="sidebar-avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
                    {r.loan?.customer?.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.loan?.customer?.name || 'N/A'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.loan?.loanNumber} · #{r.installmentNo}</div>
                  </div>
                </div>
                <span className={`badge ${r.status === 'PAID' ? 'badge-success' : r.status === 'OVERDUE' ? 'badge-danger' : r.status === 'PARTIAL' ? 'badge-warning' : 'badge-muted'}`}>
                  {r.status === 'PAID' ? <CheckCircle size={9} /> : r.status === 'OVERDUE' ? <AlertTriangle size={9} /> : <Clock size={9} />}
                  {r.status}
                </span>
              </div>

              {/* Amount row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Due {fmtDate(r.dueDate)}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: r.status === 'PAID' ? 'var(--accent-400)' : 'var(--text-primary)' }}>
                    {r.status === 'PAID' || (r.dueAmount - r.paidAmount) <= 0 ? (
                      <span style={{ color: 'var(--success-500)' }}>₹{r.paidAmount.toLocaleString('en-IN')} <span style={{ fontSize: 12, fontWeight: 600 }}>Collected</span></span>
                    ) : (
                      `₹${(r.dueAmount - r.paidAmount).toLocaleString('en-IN')}`
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {r.principal > 0 && (
                      <span style={{ fontSize: 11, background: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary-600, #4f46e5)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                        Principal: ₹{r.principal.toLocaleString('en-IN')}
                      </span>
                    )}
                    {r.interest > 0 && (
                      <span style={{ fontSize: 11, background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                        Interest: ₹{r.interest.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  {r.loan?.customer?.phone && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Phone size={10} /><a href={`tel:${r.loan.customer.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{r.loan.customer.phone}</a>
                    </div>
                  )}
                </div>
                {r.status !== 'PAID' && r.status !== 'CARRIED_FORWARD' && (
                  isBlocked ? (
                    // Informative Locked button
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ minWidth: 95, background: 'rgba(244,63,94,0.06)', color: '#e11d48', border: '1px solid rgba(244,63,94,0.25)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700 }}
                      onClick={() => {
                        toast.error(
                          `Installment #${r.installmentNo} is locked because Installment #${blockingInstNo} is overdue!\n\nPlease collect Installment #${blockingInstNo} in the Overdue tab first, or open Loan Details to Carry Forward.`,
                          { duration: 6000 }
                        );
                      }}
                      title={`முதலில் Installment #${blockingInstNo} collect செய்யுங்கள்`}
                    >
                      <Lock size={13} /> Locked
                    </button>
                  ) : (
                    <button className="btn btn-success btn-sm" style={{ minWidth: 80 }} onClick={() => openPay(r)}>
                      <HandCoins size={14} /> Collect
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Payment Modal */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{payModal.loan?.customer?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{payModal.loan?.loanNumber} · #{payModal.installmentNo}</div>
              </div>
              <button className="modal-close" onClick={() => setPayModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handlePay}>
              <div className="modal-body">
                {/* Collection Type Selector */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 14, padding: 4, background: 'var(--bg-glass, rgba(0,0,0,0.05))', borderRadius: 8, border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${payType === 'INSTALLMENT' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, fontSize: 11, fontWeight: 700 }}
                    onClick={() => setPayType('INSTALLMENT')}
                  >
                    Installment Collection
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${payType === 'PRINCIPAL' ? 'btn-warning' : 'btn-ghost'}`}
                    style={{ flex: 1, fontSize: 11, fontWeight: 700, color: payType === 'PRINCIPAL' ? '#fff' : '#d97706' }}
                    onClick={() => setPayType('PRINCIPAL')}
                  >
                    Pay Principal & Close
                  </button>
                </div>

                {payType === 'INSTALLMENT' ? (
                  <>
                    {/* Balance summary */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-glass)', borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Due</div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>₹{payModal.dueAmount?.toLocaleString('en-IN')}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Paid</div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent-400)' }}>₹{payModal.paidAmount?.toLocaleString('en-IN')}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Balance</div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--warning-400)' }}>₹{(payModal.dueAmount - payModal.paidAmount)?.toLocaleString('en-IN')}</div>
                      </div>
                    </div>

                    {/* Principal & Interest Breakdown in Modal */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16, padding: '8px 12px', background: 'var(--bg-secondary, rgba(0,0,0,0.03))', borderRadius: 8, fontSize: 12, justifyContent: 'space-around' }}>
                      <span>Principal (அசல்): <b style={{ color: 'var(--primary-600, #4f46e5)' }}>₹{(payModal.principal || 0).toLocaleString('en-IN')}</b></span>
                      <span>Interest (வட்டி): <b style={{ color: '#d97706' }}>₹{(payModal.interest || 0).toLocaleString('en-IN')}</b></span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Amount *</label>
                      <input className="form-input" type="number" step="0.01" value={payForm.amount}
                        onChange={e => setPayForm({ ...payForm, amount: e.target.value })} required />
                    </div>
                    {payModal.status === 'OVERDUE' && (
                      <div className="form-group">
                        <label className="form-label">Interest for Overdue (₹) - optional</label>
                        <input className="form-input" type="number" min="0" placeholder="e.g. 100" value={payForm.penaltyAmount}
                          onChange={e => setPayForm({ ...payForm, penaltyAmount: e.target.value })} />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Principal Payoff Notice & Balance */}
                    <div style={{
                      padding: '12px 14px', borderRadius: 10, marginBottom: 14,
                      background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
                      fontSize: 12, color: '#b45309'
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Principal Collection / Account Closure</div>
                      <div>Customer is paying principal amount to reduce or fully close this loan account.</div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-glass)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Outstanding Principal</div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: '#d97706' }}>
                          ₹{(payModal.loan?.outstandingPrincipal ?? payModal.loan?.principalAmount ?? 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Principal Amount to Pay (₹) *</label>
                      <input
                        className="form-input"
                        type="number"
                        step="0.01"
                        placeholder="Enter principal amount"
                        value={payForm.principalAmount}
                        onChange={e => setPayForm({ ...payForm, principalAmount: e.target.value })}
                        required
                      />
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        * Paying total outstanding principal will mark this loan as FULLY CLOSED.
                      </div>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select className="form-select" value={payForm.paymentMode}
                    onChange={e => setPayForm({ ...payForm, paymentMode: e.target.value })}>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Reference / Notes (optional)</label>
                  <input className="form-input" placeholder="UPI / Txn ID or notes" value={payForm.reference}
                    onChange={e => setPayForm({ ...payForm, reference: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setPayModal(null)}>Cancel</button>
                <button type="submit" className={`btn ${payType === 'PRINCIPAL' ? 'btn-warning' : 'btn-success'}`} disabled={paying}>
                  {paying ? 'Processing...' : payType === 'PRINCIPAL' ? `Collect Principal ₹${(parseFloat(payForm.principalAmount || 0)).toLocaleString('en-IN')}` : `Collect ₹${(parseFloat(payForm.amount || 0) + parseFloat(payForm.penaltyAmount || 0)).toLocaleString('en-IN')}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

