import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    this.setState({ info });
    try { console.error('[GoalFit ErrorBoundary]', error, info); } catch (_) {}
  }
  reset = () => {
    this.setState({ error: null, info: null });
    try { window.location.reload(); } catch (_) {}
  };
  render() {
    if (this.state.error) {
      const msg = String(this.state.error?.message || this.state.error || 'Errore sconosciuto');
      const stack = String(this.state.error?.stack || '').split('\n').slice(0, 6).join('\n');
      const compStack = String(this.state.info?.componentStack || '').split('\n').slice(0, 8).join('\n');
      const detail = [msg, stack, compStack].filter(Boolean).join('\n\n');
      return (
        <div style={{position:'fixed',inset:0,background:'linear-gradient(180deg, #4A6A62 0px, #24405A 260px, #0E2240 540px)',color:'#F4EFE2',padding:28,fontFamily:"'DM Sans',system-ui,sans-serif",overflow:'auto',zIndex:99999,boxSizing:'border-box'}}>
          <div style={{maxWidth:420,minHeight:'100%',margin:'0 auto',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:18,textAlign:'center'}}>
            <span aria-hidden="true" style={{width:84,height:84,borderRadius:'50%',border:'2px solid #C9A55A',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'EB Garamond',serif",fontSize:44,color:'#C9A55A'}}>!</span>
            <h1 style={{fontFamily:"'EB Garamond',serif",fontSize:34,fontWeight:500,lineHeight:1.1,margin:0}}>Qualcosa si è inceppato</h1>
            <p style={{fontSize:15,lineHeight:1.5,color:'#B4BFCC',margin:0}}>I tuoi dati sono al sicuro. Ricarica l'app per riprendere da dove eri.</p>
            <button onClick={this.reset} style={{minHeight:50,width:'100%',borderRadius:25,background:'#C9A55A',border:'1px solid #C9A55A',color:'#0E2240',fontFamily:'inherit',fontSize:15,fontWeight:700,cursor:'pointer'}}>ricarica l'app</button>
            <details style={{width:'100%',textAlign:'left'}}>
              <summary style={{fontSize:13,textDecoration:'underline',textUnderlineOffset:3,cursor:'pointer',textAlign:'center',minHeight:36}}>mostra i dettagli tecnici</summary>
              <pre style={{marginTop:10,padding:12,background:'#142A4C',border:'1px solid #34506F',borderRadius:14,fontFamily:'ui-monospace,monospace',fontSize:11,whiteSpace:'pre-wrap',wordBreak:'break-word',color:'#B4BFCC'}}>{detail}</pre>
              <p style={{fontSize:12,color:'#B4BFCC',lineHeight:1.5}}>Se il problema si ripete, manda uno screenshot di questi dettagli all'assistenza.</p>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
