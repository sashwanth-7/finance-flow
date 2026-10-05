import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI, loansAPI } from '../services/api';
import { Landmark, Users, HandCoins, AlertTriangle, CheckCircle, Plus, TrendingUp, IndianRupee, Calendar, Clock, BarChart3, ChevronRight, PieChart, X, Search, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend } from 'recharts';

function fmt(val) {
  if (!val && val !== 0) return '₹0';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '₹0';
  return `₹${Number.isInteger(num) ? num.toLocaleString('en-IN') : num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const StatCard = ({ icon: Icon, label, value, color, to, onClick }) => {
  const content = (
    <>
      <div className={`stat-icon ${color}`} style={{ marginBottom: '10px' }}><Icon size={18} /></div>
      <div className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{value}</div>
      <div className="stat-label" style={{ marginTop: 'auto', fontSize: '11px' }}>{label}</div>
    </>
  );

  if (onClick) {
    return (
      <div 
        onClick={onClick} 
        className={`stat-card ${color}`} 
        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: '16px', height: '100%' }}
      >
        {content}
      </div>
    );
  }

  return (
    <Link to={to} className={`stat-card ${color}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', padding: '16px', height: '100%' }}>
      {content}
    </Link>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const cacheKey = `dashboard_cache_${user?.companyId || 'nocompany'}_${user?.id || 'default'}`;

  const [data, setData] = useState(() => {
    try {
      const key = `dashboard_cache_${user?.companyId || 'nocompany'}_${user?.id || 'default'}`;
      const cached = localStorage.getItem(key);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!data);

  // Tenant cache isolation: reload data and switch cache if company or user changes
  useEffect(() => {
    try {
      const key = `dashboard_cache_${user?.companyId || 'nocompany'}_${user?.id || 'default'}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        setData(JSON.parse(cached));
        setLoading(false);
      } else {
        setData(null);
        setLoading(true);
      }
    } catch (e) {}
    loadData();
  }, [user?.id, user?.companyId]);

  // Breakdown modal states
  const [activeModal, setActiveModal] = useState(null); // 'DISBURSED' | 'OUTSTANDING' | null
  const [modalLoanType, setModalLoanType] = useState('ALL'); // 'ALL' | 'FLAT' | 'WITHOUT_INTEREST' | 'EMI'
  const [breakdownLoans, setBreakdownLoans] = useState([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = () => {
    Promise.all([dashboardAPI.summary(), dashboardAPI.agent()])
      .then(([s, a]) => {
        const fresh = { summary: s, agent: a };
        setData(fresh);
        try {
          const key = `dashboard_cache_${user?.companyId || 'nocompany'}_${user?.id || 'default'}`;
          localStorage.setItem(key, JSON.stringify(fresh));
        } catch (e) {
          console.warn('Dashboard cache write failed', e);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // 5s fast auto-refresh
    const handleRefresh = () => loadData();
    window.addEventListener('focus', handleRefresh);
    window.addEventListener('payment-recorded', handleRefresh);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadData();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('payment-recorded', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const openBreakdownModal = (type, loanType = 'ALL') => {
    setActiveModal(type);
    setModalLoanType(loanType);
    setSearchQuery('');
    setLoadingLoans(true);
    
    // Fetch all relevant loans for breakdown
    const params = type === 'OUTSTANDING' ? { status: 'ACTIVE', limit: 200 } : { limit: 200 };
    loansAPI.list(params)
      .then(res => {
        setBreakdownLoans(res || []);
      })
      .catch(console.error)
      .finally(() => setLoadingLoans(false));
  };

  if (loading && !data) return <div className="loading-page"><div className="spinner" /></div>;

  const s = data?.summary;
  const a = data?.agent;
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  // Filter breakdown loans by search and loan type
  const filteredLoans = breakdownLoans.filter(l => {
    if (modalLoanType !== 'ALL' && l.interestType !== modalLoanType) return false;
    const q = searchQuery.toLowerCase();
    const name = l.customer?.name?.toLowerCase() || '';
    const phone = l.customer?.phone || '';
    const num = l.loanNumber?.toLowerCase() || '';
    return name.includes(q) || phone.includes(q) || num.includes(q);
  });

  return (
    <div className="animate-in" style={{ paddingBottom: '40px' }}>
      {/* Greeting & Quick Actions */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Hi, {user?.name?.split(' ')[0]} 👋</div>
          <div className="color-muted" style={{ fontSize: 12, marginTop: 2 }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        
        {/* Top Right Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link to="/customers?new=true" className="btn btn-ghost btn-sm" style={{ padding: '5px 10px', borderRadius: '100px', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', fontSize: 11 }}>
            <Plus size={13} style={{ marginRight: 2 }}/> Customer
          </Link>
          {isAdmin && (
            <Link to="/payment-history" className="btn btn-ghost btn-sm" style={{ padding: '5px 10px', borderRadius: '100px', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', fontSize: 11 }}>
               <FileText size={13} style={{ marginRight: 2 }}/> History
            </Link>
          )}
        </div>
      </div>

      {/* Main Quick Actions below */}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 16, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        <Link to="/loans/create" className="btn btn-primary btn-sm" style={{ flexShrink: 0, padding: '8px 16px', borderRadius: '100px' }}>
          <Plus size={16}/> New Loan
        </Link>
        <Link to="/collections" className="btn btn-success btn-sm" style={{ flexShrink: 0, padding: '8px 16px', borderRadius: '100px' }}>
          <HandCoins size={16}/> Collect
        </Link>
      </div>

      {isAdmin ? (
        <>


          {/* Section 1: Overall Financials */}
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, marginTop: 24, color: 'var(--text-primary)' }}>Overall Financials</div>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 16 }}>
            <StatCard onClick={() => openBreakdownModal('DISBURSED')} icon={IndianRupee} label="Total Disbursed (வழங்கியது)" value={fmt(s?.totalDisbursed)} color="green" />
            <StatCard to="/loans" icon={Landmark} label="Principal Outstanding (அசல் நிலுவை)" value={fmt(s?.outstandingPrincipal)} color="purple" />
            <StatCard onClick={() => openBreakdownModal('OUTSTANDING')} icon={TrendingUp} label="Interest Outstanding (வட்டி நிலுவை)" value={fmt(s?.outstandingInterest)} color="yellow" />
            <StatCard onClick={() => openBreakdownModal('OUTSTANDING')} icon={Landmark} label="Total Outstanding (மொத்த நிலுவை)" value={fmt(s?.outstandingAmount)} color="blue" />
            <StatCard to="/payment-history" icon={HandCoins} label="Total Collected (மொத்த வசூல்)" value={fmt(s?.totalCollected)} color="purple" />
            <StatCard to="/payment-history" icon={HandCoins} label="Principal Collected (அசல் வசூல்)" value={fmt(s?.totalPrincipalCollected)} color="green" />
            <StatCard to="/profit" icon={TrendingUp} label="Interest Profit (வட்டி லாபம்)" value={fmt(s?.totalInterestCollected)} color="yellow" />
            <StatCard to="/payment-history" icon={AlertTriangle} label="Penalty Profit (அபராதம்)" value={fmt(s?.totalPenaltyCollected)} color="red" />
            <StatCard to="/profit" icon={TrendingUp} label="Total Profit (மொத்த லாபம்)" value={fmt(s?.totalCombinedProfit)} color="green" />
          </div>



          {/* Section 2: Today's Metrics */}
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, marginTop: 24, color: 'var(--text-primary)' }}>Today's Performance (இன்றைய செயல்பாடு)</div>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
            <StatCard to="/collections" icon={Calendar} label="Today's Collection (இன்றைய வசூல்)" value={fmt(s?.todayCollection)} color="green" />
            <StatCard to="/collections" icon={HandCoins} label="Today's Principal (அசல் வசூல்)" value={fmt(s?.todayPrincipalCollected)} color="purple" />
            <StatCard to="/profit" icon={TrendingUp} label="Today's Interest (வட்டி லாபம்)" value={fmt(s?.todayInterestCollected)} color="yellow" />
            <StatCard to="/payment-history" icon={AlertTriangle} label="Today's Penalty (அபராதம்)" value={fmt(s?.todayPenaltyCollected)} color="red" />
            <StatCard to="/collections" icon={Clock} label="Today's Due (இன்றைய டியூ)" value={fmt(s?.todayDueAmount)} color="blue" />
            <StatCard to="/collections" icon={AlertTriangle} label="Remaining Due (மீதமுள்ள டியூ)" value={fmt(s?.remainingToday)} color="yellow" />
            <StatCard to="/collections" icon={PieChart} label="Pending (All) (நிலுவையில் உள்ளவை)" value={fmt(s?.pendingCollections)} color="purple" />
          </div>

          {/* Section 3: Entities */}
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <StatCard to="/customers" icon={Users} label="Active Customers (வாடிக்கையாளர்கள்)" value={s?.activeCustomers} color="blue" />
            <StatCard to="/loans?status=ACTIVE" icon={Landmark} label="Active Loans (நடப்பு கடன்கள்)" value={s?.activeLoans} color="green" />
          </div>



        </>
      ) : (
        <>
          {/* Default Agent View */}
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <Link to="/collections" className="stat-card green" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="stat-icon green" style={{ marginBottom: 10 }}><IndianRupee size={18} /></div>
              <div className="stat-value" style={{ fontSize: '1.2rem', fontWeight: 800 }}>{fmt(a?.collectedToday?.amount || 0)}</div>
              <div className="stat-label" style={{ fontSize: '11px' }}>Collected Today</div>
            </Link>
            <Link to="/collections" className="stat-card blue" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="stat-icon blue" style={{ marginBottom: 10 }}><Landmark size={18} /></div>
              <div className="stat-value" style={{ fontSize: '1.2rem', fontWeight: 800 }}>{fmt(a?.totalCollected?.amount || 0)}</div>
              <div className="stat-label" style={{ fontSize: '11px' }}>Total Collected</div>
            </Link>
          </div>
          
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div className="stat-card orange" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="stat-icon orange" style={{ marginBottom: 10 }}><Users size={18} /></div>
              <div className="stat-value" style={{ fontSize: '1.2rem', fontWeight: 800 }}>{a?.collectedToday?.count || 0}</div>
              <div className="stat-label" style={{ fontSize: '11px' }}>Customers Seen Today</div>
            </div>
            <div className="stat-card purple" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="stat-icon purple" style={{ marginBottom: 10 }}><CheckCircle size={18} /></div>
              <div className="stat-value" style={{ fontSize: '1.2rem', fontWeight: 800 }}>{a?.totalCollected?.count || 0}</div>
              <div className="stat-label" style={{ fontSize: '11px' }}>Total Collections Made</div>
            </div>
          </div>
        </>
      )}

      {/* Breakdown Modal (Disbursed & Outstanding) */}
      {activeModal && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal modal-lg animate-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>
                  {activeModal === 'DISBURSED' ? 'Total Disbursed Breakdown (விநியோக விவரங்கள்)' : 'Total Outstanding Dues (நிலுவைத் தொகை விவரங்கள்)'}
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {activeModal === 'DISBURSED' 
                    ? `Total: ${fmt(s?.totalDisbursed)} (யார் யாருக்கு எவ்வளவு கடன் கொடுக்கப்பட்டது)` 
                    : `Total: ${fmt(s?.outstandingAmount)} (யார் யாருக்கு எவ்வளவு நிலுவை உள்ளது)`}
                </div>
              </div>
              <button className="modal-close" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Interactive Loan Type Filter Cards */}
              {activeModal === 'OUTSTANDING' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 10, marginBottom: 16 }}>
                  {/* All Loans Card */}
                  <div 
                    onClick={() => setModalLoanType('ALL')}
                    style={{ 
                      background: modalLoanType === 'ALL' ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-subtle, rgba(0,0,0,0.03))', 
                      border: modalLoanType === 'ALL' ? '2px solid var(--primary-500)' : '1px solid var(--border-subtle)', 
                      padding: '10px 12px', 
                      borderRadius: 12, 
                      cursor: 'pointer',
                      boxShadow: modalLoanType === 'ALL' ? '0 2px 8px rgba(59, 130, 246, 0.2)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>All Loans (எல்லாமும்)</span>
                      {modalLoanType === 'ALL' && <span style={{ fontSize: 9, background: 'var(--primary-500)', color: '#fff', padding: '1px 5px', borderRadius: 6, fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--primary-600)', marginTop: 2 }}>
                      {fmt(s?.outstandingAmount)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 4, fontSize: 10, color: 'var(--text-muted)', borderTop: '1px dashed var(--border-subtle)', paddingTop: 4 }}>
                      <div>Principal: <b>{fmt(s?.outstandingPrincipal)}</b></div>
                      <div>Interest: <b>{fmt(s?.outstandingInterest)}</b></div>
                    </div>
                  </div>

                  {/* Regular Interest Card */}
                  <div 
                    onClick={() => setModalLoanType('FLAT')}
                    style={{ 
                      background: modalLoanType === 'FLAT' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.04)', 
                      border: modalLoanType === 'FLAT' ? '2px solid #2563EB' : '1px solid rgba(37, 99, 235, 0.18)', 
                      padding: '10px 12px', 
                      borderRadius: 12, 
                      cursor: 'pointer',
                      boxShadow: modalLoanType === 'FLAT' ? '0 2px 8px rgba(37, 99, 235, 0.2)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Regular Flat Interest (வட்டி கடன்)</span>
                      {modalLoanType === 'FLAT' && <span style={{ fontSize: 9, background: '#2563EB', color: '#fff', padding: '1px 5px', borderRadius: 6, fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#2563EB', marginTop: 2 }}>
                      {fmt(s?.outstandingByLoanType?.FLAT?.amount)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 4, fontSize: 10, color: 'var(--text-muted)', borderTop: '1px dashed rgba(37, 99, 235, 0.2)', paddingTop: 4 }}>
                      <div>Principal: <b>{fmt(s?.outstandingByLoanType?.FLAT?.principal)}</b></div>
                      <div>Interest: <b>{fmt(s?.outstandingByLoanType?.FLAT?.interest)}</b></div>
                    </div>
                  </div>

                  {/* Deduction Based Card */}
                  <div 
                    onClick={() => setModalLoanType('WITHOUT_INTEREST')}
                    style={{ 
                      background: modalLoanType === 'WITHOUT_INTEREST' ? 'rgba(5, 150, 105, 0.15)' : 'rgba(5, 150, 105, 0.04)', 
                      border: modalLoanType === 'WITHOUT_INTEREST' ? '2px solid #059669' : '1px solid rgba(5, 150, 105, 0.18)', 
                      padding: '10px 12px', 
                      borderRadius: 12, 
                      cursor: 'pointer',
                      boxShadow: modalLoanType === 'WITHOUT_INTEREST' ? '0 2px 8px rgba(5, 150, 105, 0.2)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Deduction Based (கந்து வட்டி)</span>
                      {modalLoanType === 'WITHOUT_INTEREST' && <span style={{ fontSize: 9, background: '#059669', color: '#fff', padding: '1px 5px', borderRadius: 6, fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#059669', marginTop: 2 }}>
                      {fmt(s?.outstandingByLoanType?.WITHOUT_INTEREST?.amount)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 4, fontSize: 10, color: 'var(--text-muted)', borderTop: '1px dashed rgba(5, 150, 105, 0.2)', paddingTop: 4 }}>
                      <div>Principal: <b>{fmt(s?.outstandingByLoanType?.WITHOUT_INTEREST?.principal)}</b></div>
                      <div>Interest: <b>{fmt(s?.outstandingByLoanType?.WITHOUT_INTEREST?.interest)}</b></div>
                    </div>
                  </div>

                  {/* Reducing Principal Card */}
                  <div 
                    onClick={() => setModalLoanType('EMI')}
                    style={{ 
                      background: modalLoanType === 'EMI' ? 'rgba(124, 58, 237, 0.15)' : 'rgba(124, 58, 237, 0.04)', 
                      border: modalLoanType === 'EMI' ? '2px solid #7C3AED' : '1px solid rgba(124, 58, 237, 0.18)', 
                      padding: '10px 12px', 
                      borderRadius: 12, 
                      cursor: 'pointer',
                      boxShadow: modalLoanType === 'EMI' ? '0 2px 8px rgba(124, 58, 237, 0.2)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>EMI (அசலோடு தவணை)</span>
                      {modalLoanType === 'EMI' && <span style={{ fontSize: 9, background: '#7C3AED', color: '#fff', padding: '1px 5px', borderRadius: 6, fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#7C3AED', marginTop: 2 }}>
                      {fmt(s?.outstandingByLoanType?.EMI?.amount)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 4, fontSize: 10, color: 'var(--text-muted)', borderTop: '1px dashed rgba(124, 58, 237, 0.2)', paddingTop: 4 }}>
                      <div>Principal: <b>{fmt(s?.outstandingByLoanType?.EMI?.principal)}</b></div>
                      <div>Interest: <b>{fmt(s?.outstandingByLoanType?.EMI?.interest)}</b></div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Disbursed Filter Tabs */
                <div className="tabs" style={{ marginBottom: 14 }}>
                  {[
                    ['ALL', 'All Types'],
                    ['FLAT', 'Regular Flat Interest (வட்டி கடன்)'],
                    ['WITHOUT_INTEREST', 'Deduction Based (கந்து வட்டி)'],
                    ['EMI', 'EMI (அசலோடு தவணை)']
                  ].map(([val, label]) => (
                    <button 
                      key={val} 
                      className={`tab ${modalLoanType === val ? 'active' : ''}`}
                      onClick={() => setModalLoanType(val)}
                      style={{ fontSize: 12, padding: '6px 12px' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Search Bar */}
              <div className="search-bar" style={{ marginBottom: 16, maxWidth: '100%' }}>
                <Search size={16} />
                <input 
                  type="text" 
                  placeholder="Search customer name, phone, or loan number..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {loadingLoans ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div className="spinner" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading breakdown data...</div>
                </div>
              ) : filteredLoans.length === 0 ? (
                <div className="empty-state">
                  <FileText size={40} />
                  <h3>No records found</h3>
                  <p style={{ fontSize: 12 }}>No matching customer loans for this breakdown.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Loan No</th>
                        <th>Date</th>
                        {activeModal === 'DISBURSED' ? (
                          <th>Disbursed Principal</th>
                        ) : (
                          <>
                            <th>Disbursed</th>
                            <th>{modalLoanType === 'FLAT' ? 'Interest Collected (வட்டி வசூல்)' : 'Collected (வசூல்)'}</th>
                            <th>Principal Due</th>
                            <th>Interest Due</th>
                            <th>Total Outstanding</th>
                          </>
                        )}
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLoans.map(loan => {
                        const type = loan.interestType || 'FLAT';
                        const totalCollected = (loan.repayments || []).reduce((acc, r) => acc + (r.paidAmount || 0), 0);
                        
                        let princDue = loan.outstandingPrincipal ?? loan.principalAmount;
                        let intDue = 0;

                        if (type === 'FLAT') {
                          // Regular Interest: Principal = remaining principal. Interest = due/overdue unpaid interest up to today
                          const startOfToday = new Date();
                          startOfToday.setHours(0, 0, 0, 0);
                          intDue = (loan.repayments || [])
                            .filter(r => r.status === 'OVERDUE' || (r.status === 'PENDING' && new Date(r.dueDate) <= startOfToday) || r.status === 'PARTIAL')
                            .reduce((acc, r) => acc + Math.max(0, (r.dueAmount || 0) - (r.paidAmount || 0)), 0);
                        } else if (type === 'WITHOUT_INTEREST') {
                          princDue = Math.max(0, (loan.totalPayable || loan.principalAmount) - totalCollected);
                          intDue = 0;
                        } else {
                          const rem = Math.max(0, (loan.totalPayable || loan.principalAmount) - totalCollected);
                          princDue = Math.min(rem, loan.outstandingPrincipal ?? loan.principalAmount);
                          intDue = Math.max(0, rem - princDue);
                        }

                        const outstandingAmt = princDue + intDue;

                        return (
                          <tr key={loan.id}>
                            <td data-label="Customer">
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{loan.customer?.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{loan.customer?.phone}</div>
                            </td>
                            <td data-label="Loan No">
                              <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{loan.loanNumber}</span>
                            </td>
                            <td data-label="Date">
                              {new Date(loan.startDate || loan.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            {activeModal === 'DISBURSED' ? (
                              <td data-label="Disbursed Principal">
                                <span style={{ fontWeight: 800, color: 'var(--accent-600)', fontSize: 15 }}>
                                  ₹{loan.principalAmount?.toLocaleString('en-IN')}
                                </span>
                              </td>
                            ) : (
                              <>
                                <td data-label="Disbursed">
                                  ₹{loan.principalAmount?.toLocaleString('en-IN')}
                                </td>
                                <td data-label={type === 'FLAT' ? 'Interest Collected' : 'Collected'}>
                                  <span style={{ fontWeight: 600, color: '#059669' }}>₹{totalCollected?.toLocaleString('en-IN')}</span>
                                  {type === 'FLAT' && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>(வட்டி வசூல்)</div>}
                                </td>
                                <td data-label="Principal Due">
                                  <span style={{ fontWeight: 700, color: '#7C3AED' }}>₹{princDue?.toLocaleString('en-IN')}</span>
                                </td>
                                <td data-label="Interest Due">
                                  <span style={{ fontWeight: 700, color: '#D97706' }}>₹{intDue?.toLocaleString('en-IN')}</span>
                                </td>
                                <td data-label="Total Outstanding">
                                  <span style={{ fontWeight: 800, color: 'var(--primary-600)', fontSize: 15 }}>
                                    ₹{outstandingAmt?.toLocaleString('en-IN')}
                                  </span>
                                </td>
                              </>
                            )}
                            <td data-label="Status">
                              <span className={`badge ${loan.status === 'ACTIVE' ? 'badge-info' : loan.status === 'CLOSED' ? 'badge-success' : 'badge-danger'}`}>
                                {loan.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setActiveModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


