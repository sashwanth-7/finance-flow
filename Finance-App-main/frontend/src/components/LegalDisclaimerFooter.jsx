import React, { useState } from 'react';
import { Shield, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { LEGAL_DISCLAIMERS } from '../utils/legalDisclaimers';

export default function LegalDisclaimerFooter() {
  const [expanded, setExpanded] = useState(false);

  return (
    <footer 
      style={{
        marginTop: 40,
        padding: '16px 20px',
        borderTop: '1px solid var(--border-color, #e2e8f0)',
        background: 'rgba(248, 250, 252, 0.6)',
        borderRadius: 8,
        fontSize: 12,
        color: 'var(--text-muted, #64748b)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          <Shield size={14} style={{ color: 'var(--primary-600, #4f46e5)' }} />
          <span>LoanFlowPro Regulatory & Legal Compliance Notice</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary-600, #4f46e5)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          {expanded ? 'Hide Details' : 'View Legal Disclaimer'}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border-color, #cbd5e1)', lineHeight: 1.6 }}>
          <p style={{ marginBottom: 8 }}>
            <strong>Developer Liability Shield:</strong> {LEGAL_DISCLAIMERS.DEVELOPER_LIABILITY_NOTICE}
          </p>
          <p style={{ marginBottom: 8 }}>
            <strong>Fair Lending & APR Notice:</strong> {LEGAL_DISCLAIMERS.FAIR_LENDING_DISCLOSURE}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Data Privacy & Consent:</strong> {LEGAL_DISCLAIMERS.DATA_PRIVACY_CONSENT}
          </p>
        </div>
      )}
    </footer>
  );
}
