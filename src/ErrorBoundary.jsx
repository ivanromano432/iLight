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
      return (
        <div style={{position:'fixed',inset:0,background:'#1F140C',color:'#E8D8B8',padding:24,fontFamily:'system-ui,sans-serif',overflow:'auto',zIndex:99999}}>
          <div style={{maxWidth:560,margin:'0 auto'}}>
            <div style={{fontSize:14,letterSpacing:'0.3em',color:'#C9A876',marginBottom:18,textTransform:'uppercase'}}>Errore inatteso</div>
            <div style={{fontSize:15,lineHeight:1.5,marginBottom:24,color:'#E8D8B8'}}>
              L'app ha incontrato un errore e si è interrotta. Mandami uno screenshot di questa schermata così posso correggere.
            </div>
            <div style={{padding:12,background:'#2A1810',border:'1px solid #C9A87644',borderRadius:4,marginBottom:16}}>
              <div style={{fontSize:10,letterSpacing:'0.2em',color:'#8B7355',marginBottom:6,textTransform:'uppercase'}}>Messaggio</div>
              <div style={{fontFamily:'ui-monospace,monospace',fontSize:12,wordBreak:'break-word',color:'#E8D8B8'}}>{msg}</div>
            </div>
            {stack && (
              <div style={{padding:12,background:'#2A1810',border:'1px solid #C9A87622',borderRadius:4,marginBottom:16}}>
                <div style={{fontSize:10,letterSpacing:'0.2em',color:'#8B7355',marginBottom:6,textTransform:'uppercase'}}>Stack</div>
                <pre style={{fontFamily:'ui-monospace,monospace',fontSize:10,whiteSpace:'pre-wrap',wordBreak:'break-word',color:'#C9A876',margin:0}}>{stack}</pre>
              </div>
            )}
            {compStack && (
              <div style={{padding:12,background:'#2A1810',border:'1px solid #C9A87622',borderRadius:4,marginBottom:24}}>
                <div style={{fontSize:10,letterSpacing:'0.2em',color:'#8B7355',marginBottom:6,textTransform:'uppercase'}}>Componente</div>
                <pre style={{fontFamily:'ui-monospace,monospace',fontSize:10,whiteSpace:'pre-wrap',wordBreak:'break-word',color:'#C9A876',margin:0}}>{compStack}</pre>
              </div>
            )}
            <button onClick={this.reset} style={{background:'#C9A876',color:'#1F140C',border:'none',padding:'14px 24px',fontSize:11,letterSpacing:'0.3em',cursor:'pointer',textTransform:'uppercase'}}>
              Ricarica l'app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
