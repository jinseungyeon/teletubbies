import React from 'react';

// The map/editor/settings surfaces are the reference app's own components. They
// already own the camera, team rectangle, seat picker, character draft and
// notification settings; this file turns their renderVals() contract into JSX.
const Base = window.__SenspaceComponent;

class ReferenceView extends Base {}

export class MapView extends ReferenceView {
  // React attaches wheel handlers passively, so the map's own preventDefault
  // cannot stop the browser's page zoom. Keep wheel events inside the map: it
  // already uses them for its camera, and in the old iframe they never reached
  // the host page.
  componentDidMount() {
    super.componentDidMount();
    const el = this.mapRef.current;
    if (!el) return;
    this._wheelEl = el;
    this._wheelGuard = event => { if (event.cancelable) event.preventDefault(); };
    el.addEventListener('wheel', this._wheelGuard, { passive: false });
  }

  componentWillUnmount() {
    if (this._wheelEl) this._wheelEl.removeEventListener('wheel', this._wheelGuard);
    super.componentWillUnmount();
  }

  render() {
    const v = this.renderVals();
    return (
      <>
        <div
          ref={v.mapRef}
          style={{ ...v.vpStyle, position: 'absolute', inset: 0, flex: 'none' }}
          onPointerDown={v.vpDown}
          onPointerMove={v.vpMove}
          onPointerUp={v.vpUp}
          onWheel={v.vpWheel}
        >
          <div style={v.layerStyle}>
            <div style={{ position: 'absolute', left: 344, top: 100, width: 984, height: 644, background: "url('/src/assets/tiles/marble.png') 0 0/128px 128px", imageRendering: 'pixelated' }} />
            <div style={{ position: 'absolute', left: 64, top: 214, width: 280, height: 530, background: "url('/src/assets/tiles/marble.png') 64px 0/128px 128px", imageRendering: 'pixelated' }} />
            <div style={{ position: 'absolute', left: 344, top: 36, width: 984, height: 28, background: 'repeating-linear-gradient(90deg,#9fd4ee 0 118px,#6e7190 118px 123px)', border: '2px solid #2e2433', boxSizing: 'border-box', boxShadow: 'inset 0 3px 0 #d6f0fb' }} />
            <div style={{ position: 'absolute', left: 344, top: 62, width: 984, height: 38, background: '#f6f0e4', border: '2px solid #2e2433', borderTop: 'none', boxSizing: 'border-box', boxShadow: 'inset 0 -5px 0 #e2d8c4,0 4px 0 rgba(46,36,51,.12)' }} />
            <div style={{ position: 'absolute', left: 316, top: 36, width: 30, height: 180, background: '#efe6d6', border: '2px solid #2e2433', boxSizing: 'border-box', boxShadow: 'inset -4px 0 0 #e0d4bf' }} />
            <div style={{ position: 'absolute', left: 36, top: 188, width: 310, height: 28, background: '#efe6d6', border: '2px solid #2e2433', boxSizing: 'border-box', boxShadow: 'inset 0 -4px 0 #e0d4bf,0 4px 0 rgba(46,36,51,.12)' }} />
            <div style={{ position: 'absolute', left: 36, top: 188, width: 30, height: 584, background: '#efe6d6', border: '2px solid #2e2433', boxSizing: 'border-box', boxShadow: 'inset -4px 0 0 #e0d4bf' }} />
            <div style={{ position: 'absolute', left: 36, top: 742, width: 1324, height: 30, background: '#efe6d6', border: '2px solid #2e2433', boxSizing: 'border-box', boxShadow: 'inset 0 4px 0 #f8f2e7' }} />
            <div style={{ position: 'absolute', left: 1326, top: 36, width: 34, height: 736, background: 'repeating-linear-gradient(180deg,#9fd4ee 0 116px,#6e7190 116px 122px)', border: '2px solid #2e2433', boxSizing: 'border-box', boxShadow: 'inset 4px 0 0 #d6f0fb' }} />
            <div style={{ position: 'absolute', left: 72, top: 734, width: 78, height: 46, background: 'linear-gradient(135deg,#d9f0fb 0 45%,#eaf7fd 45% 55%,#c4e6f6 55%)', border: '2px solid #2e2433', borderRadius: 3, boxSizing: 'border-box', boxShadow: 'inset 0 0 0 3px #8fbad3' }} />
            <div style={{ position: 'absolute', left: 78, top: 430, width: 40, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 720, pointerEvents: 'none' }}>
              <span style={{ writingMode: 'vertical-rl', font: '700 13px Pretendard', color: '#4a2e1a', letterSpacing: 2 }}>정보데스크 · front desk</span>
            </div>
            {v.furniture.map((f, i) => <img key={i} src={f.src} style={f.style} alt="" />)}
            {v.mapPeople.map((m, i) => (
              <div key={i} onPointerDown={v.stop} onClick={m.onClick} style={m.style} title={m.name}>
                <img src={m.img} alt="" style={{ width: 36, height: 56, imageRendering: 'pixelated', display: 'block' }} />
              </div>
            ))}
            {v.bubbles.map((b, i) => (
              <div key={i} onPointerDown={v.stop} onClick={b.onClick} style={b.style}>
                <img src={b.icon} alt="" style={{ height: 22, width: 22, objectFit: 'contain', imageRendering: 'pixelated' }} />
                {b.showText && <span style={{ maxWidth: 104, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.text}</span>}
                <span style={b.tail} />
              </div>
            ))}
            {v.teamMask.map((tm, i) => <div key={i} style={tm.style} />)}
            {v.hasSelRect && <div style={v.selRectStyle}><span style={v.selLabelStyle}>{v.teamName}</span></div>}
            {v.pickSeat && (
              <>
                <div style={{ position: 'absolute', left: -3000, top: -3000, width: 7400, height: 6800, background: 'rgba(38,40,72,.3)', zIndex: 1700 }} />
                {v.seatMarkers.map((sm, i) => (
                  <button key={i} onPointerDown={v.stop} onClick={sm.onClick} style={sm.style}>{sm.id}</button>
                ))}
              </>
            )}
          </div>

          <div onPointerDown={v.stop} style={{ position: 'absolute', left: 14, top: 14, display: 'flex', alignItems: 'center', gap: 8, zIndex: 30 }}>
            <span style={{ display: 'flex', background: '#fbf7ef', borderRadius: 12, padding: 4, boxShadow: '0 0 0 1.5px #3a3c63,0 4px 0 rgba(23,24,58,.35)' }}>
              <button onClick={v.viewAll} style={v.viewAllStyle}>전체 공간</button>
              <button onClick={v.viewTeam} style={v.viewTeamStyle}>내 팀</button>
            </span>
            <button onClick={v.startSelect} style={{ height: 38, padding: '0 13px', borderRadius: 11, border: 'none', background: '#fbf7ef', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 0 0 1.5px #3a3c63,0 4px 0 rgba(23,24,58,.35)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="3 3"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>팀 영역 설정
            </button>
          </div>
          <div onPointerDown={v.stop} style={{ position: 'absolute', right: 14, top: 14, display: 'flex', alignItems: 'center', gap: 8, zIndex: 30 }}>
            <span style={{ display: 'flex', alignItems: 'center', background: '#fbf7ef', borderRadius: 12, padding: 4, boxShadow: '0 0 0 1.5px #3a3c63,0 4px 0 rgba(23,24,58,.35)' }}>
              <button onClick={v.zoomOut} style={{ width: 32, height: 30, border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 18, fontWeight: 800, color: '#2b2d55' }}>−</button>
              <button onClick={v.zoomFit} style={{ minWidth: 52, height: 30, border: 'none', borderRadius: 8, background: '#fff', cursor: 'pointer', font: '12px Galmuri11', color: '#2b2d55', boxShadow: 'inset 0 -2px 0 #efe6d5' }}>{v.zoomLabel}</button>
              <button onClick={v.zoomIn} style={{ width: 32, height: 30, border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 18, fontWeight: 800, color: '#2b2d55' }}>+</button>
            </span>
            <button onClick={v.toggleFull} title="전체 화면" style={{ width: 38, height: 38, borderRadius: 11, border: 'none', background: '#fbf7ef', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2b2d55', boxShadow: '0 0 0 1.5px #3a3c63,0 4px 0 rgba(23,24,58,.35)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={v.fullIcon} /></svg>
            </button>
          </div>
          {v.showZoomHint && <div style={{ position: 'absolute', left: 14, bottom: 14, padding: '7px 11px', borderRadius: 9, background: 'rgba(251,247,239,.92)', fontSize: 12, fontWeight: 600, color: '#5d5870', zIndex: 30, boxShadow: '0 0 0 1.5px #3a3c63', pointerEvents: 'none' }}>확대하면 상태 메시지가 함께 보여요</div>}

          {v.selecting && (
            <>
              <div onPointerDown={v.selDown} onPointerMove={v.selMove} onPointerUp={v.selUp} style={{ position: 'absolute', inset: 0, zIndex: 40, cursor: 'crosshair', background: 'rgba(38,40,72,.15)' }} />
              <div onPointerDown={v.stop} style={{ position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px 10px 16px', background: '#fbf7ef', borderRadius: 14, boxShadow: '0 0 0 1.5px #3a3c63,0 6px 0 rgba(23,24,58,.35)', zIndex: 50, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>지도에서 드래그해 우리 팀 영역을 그려주세요</span>
                <button onClick={v.cancelSelect} style={{ height: 36, padding: '0 14px', borderRadius: 10, background: '#f3ead8', border: '1.5px solid #dccdb2', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>취소</button>
                <button onClick={v.saveTeam} style={v.saveTeamStyle}>이 영역으로 저장</button>
              </div>
            </>
          )}
          {v.pickSeat && (
            <div onPointerDown={v.stop} style={{ position: 'absolute', left: '50%', top: 64, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 10px 10px 14px', background: '#fbf7ef', borderRadius: 16, boxShadow: '0 0 0 1.5px #3a3c63,0 6px 0 rgba(23,24,58,.35)', zIndex: 50, whiteSpace: 'nowrap' }}>
              <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#2b2d55', color: '#fff', font: '700 14px Galmuri11', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>내 자리 지정</span>
                <span style={{ fontSize: 12.5, color: '#8a8499' }}>실제 내 자리를 눌러 캐릭터를 앉혀주세요</span>
              </span>
              <span style={{ padding: '7px 12px', borderRadius: 9, background: '#ece8fb', border: '1.5px solid #8b7fe0', font: '13px Galmuri11', color: '#4b3fb8' }}>{v.seatDraft}</span>
              <button onClick={v.confirmSeat} style={{ height: 40, padding: '0 16px', border: 'none', borderRadius: 11, background: '#2b2d55', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: 'inset 0 -3px 0 #17183a' }}>내 자리로 입장하기 →</button>
            </div>
          )}
        </div>

        {v.hasPop && (
          <div onPointerDown={v.stop} style={{ ...v.pop.style, position: 'absolute' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ ...v.pop.avStyle, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                <img src={v.pop.img} alt="" style={{ width: 44, height: 'auto', margin: 0, imageRendering: 'pixelated', display: 'block', flex: 'none' }} />
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{v.pop.name}</span>
                <span style={{ fontSize: 12, color: '#8a8499' }}>{v.pop.role} · {v.pop.seat}</span>
              </span>
              <button onClick={v.closePop} style={{ width: 26, height: 26, borderRadius: 8, border: '1.5px solid #e2d6c2', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6e6a84' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div style={v.pop.statusStyle}>
              <img src={v.pop.statusIcon} alt="" style={{ height: 15, width: 18, objectFit: 'contain', imageRendering: 'pixelated' }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <b style={{ fontSize: 13.5 }}>{v.pop.statusTitle}</b>
                <span style={{ fontSize: 12, opacity: .85 }}>{v.pop.statusSub}</span>
              </span>
            </div>
            {v.pop.hasMsg && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: '#fff', border: '1px solid #ece2cf', fontSize: 13 }}><img src={v.pop.msgIcon} alt="" style={{ height: 13, width: 16, objectFit: 'contain', imageRendering: 'pixelated' }} />{v.pop.msg}</div>}
            <button onClick={v.pop.openCard} style={{ height: 36, borderRadius: 10, border: 'none', background: '#2b2d55', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: 'inset 0 -3px 0 #17183a' }}>감각 카드 보기</button>
            <span style={v.pop.tailStyle} />
          </div>
        )}

        {v.hasToast && <div style={{ position: 'absolute', left: '50%', top: 76, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderRadius: 12, background: '#2b2d55', color: '#fff', fontSize: 14, fontWeight: 700, boxShadow: 'inset 0 -3px 0 #17183a,0 16px 30px -12px rgba(23,24,58,.7)', zIndex: 400, whiteSpace: 'nowrap' }}><span style={{ font: '12px Galmuri11', color: '#f0c04a' }}>✦</span>{v.toast}</div>}
      </>
    );
  }
}

export class EditorView extends ReferenceView {
  render() {
    const v = this.renderVals();
    if (!v.showEditor) return null;
    const ed = v.ed;
    return (
      <div onClick={v.closeEditorBackdrop} style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, boxSizing: 'border-box', background: 'transparent' }}>
        {v.edOnboard && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 999, background: 'rgba(251,247,239,.95)', boxShadow: '0 0 0 1.5px #3a3c63' }}>
            {v.obSteps.map((st, i) => (
              <React.Fragment key={i}>
                {st.line && <span style={{ width: 36, height: 2, background: '#e2d6c2' }} />}
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={st.numStyle}>{st.n}</span><span style={st.labelStyle}>{st.label}</span></span>
              </React.Fragment>
            ))}
          </div>
        )}
        <div onClick={v.stop} style={{ width: 'min(860px,100%)', background: '#fbf7ef', borderRadius: 22, boxShadow: '0 0 0 2px #3b3e6e,inset 0 1px 0 #fff,0 30px 70px -20px rgba(0,0,0,.7)', display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: 'calc(100dvh - 48px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px 14px', borderBottom: '1px solid #efe6d5' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.4 }}>{ed.title}</div>
              <div style={{ fontSize: 13, color: '#8a8499' }}>{ed.sub}</div>
            </div>
            {v.edClosable && <button onClick={v.closeModal} style={{ width: 34, height: 34, borderRadius: 10, border: '1.5px solid #e2d6c2', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4560' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>}
          </div>
          <div style={{ padding: '20px 24px', minHeight: 380, display: 'flex', gap: 20, boxSizing: 'border-box', overflow: 'auto' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {ed.isFace && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#4a4560' }}>머리 모양</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 8 }}>
                    {ed.heads.map((o, i) => (
                      <button key={i} onClick={o.onClick} style={o.style}><span style={{ width: 56, height: 52, overflow: 'hidden', display: 'block' }}><img src={o.img} alt="" style={{ width: 72, height: 112, margin: '-10px 0 0 -8px', imageRendering: 'pixelated', display: 'block' }} /></span></button>
                    ))}
                  </div>
                  {ed.swRows.map((row, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 58, fontSize: 13, fontWeight: 800, color: '#4a4560' }}>{row.label}</span>
                      <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{row.sw.map((sw, j) => <button key={j} onClick={sw.onClick} style={sw.style} />)}</span>
                    </div>
                  ))}
                </>
              )}
              {ed.isOutfit && (
                <>
                  <div style={{ display: 'flex', gap: 6 }}>{ed.outTabs.map((t, i) => <button key={i} onClick={t.onClick} style={t.style}>{t.label}</button>)}</div>
                  {ed.isBasic && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#4a4560' }}>성별</span>
                        <span style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: 200, background: '#efe6d5', borderRadius: 10, padding: 3 }}>{ed.genders.map((g, i) => <button key={i} onClick={g.onClick} style={g.style}>{g.label}</button>)}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>{ed.outfits.map((o, i) => <button key={i} onClick={o.onClick} style={o.style}><img src={o.img} alt="" style={{ width: 45, height: 70, imageRendering: 'pixelated' }} /></button>)}</div>
                    </>
                  )}
                  {ed.isSpecial && ed.specialGroups.map((grp, gi) => (
                    <React.Fragment key={gi}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#8a8499' }}>{grp.label}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 8 }}>
                        {grp.items.map((o, i) => <button key={i} onClick={o.onClick} style={o.style}><img src={o.img} alt="" style={{ width: 45, height: 70, imageRendering: 'pixelated' }} /><span style={{ fontSize: 12, fontWeight: 800, color: '#4a4560' }}>{o.name}</span></button>)}
                      </div>
                    </React.Fragment>
                  ))}
                </>
              )}
            </div>
            {ed.showPreview && (
              <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <span style={{ font: '12px Galmuri11', color: '#5b4fc9', padding: '4px 10px', borderRadius: 6, background: '#ece8fb', borderBottom: '2px solid #8b7fe0' }}>미리보기</span>
                <div style={{ width: '100%', flex: 1, minHeight: 230, borderRadius: 14, backgroundColor: '#fbf8f2', backgroundImage: 'linear-gradient(#efe8da 1px,transparent 1px),linear-gradient(90deg,#efe8da 1px,transparent 1px)', backgroundSize: '10px 10px', border: '1.5px solid #e7dcc8', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 -3px 0 #ece2cf' }}><img src={ed.preview} alt="" style={{ width: 108, height: 168, imageRendering: 'pixelated' }} /></div>
                {ed.showTools && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={ed.reset} title="처음으로" style={{ width: 44, height: 40, borderRadius: 11, border: '1.5px solid #e2d6c2', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4560', boxShadow: 'inset 0 -3px 0 #efe6d5' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12a8 8 0 1 1-3-6.2" /><path d="M20 4v5h-5" /></svg></button>
                    <button onClick={ed.shuffle} title="랜덤" style={{ width: 44, height: 40, borderRadius: 11, border: '1.5px solid #e2d6c2', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4560', boxShadow: 'inset 0 -3px 0 #efe6d5' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h3c5 0 5 10 10 10h3" /><path d="M4 17h3c2 0 3-1.5 4-3.5M13 9.5c1-2 2-2.5 4-2.5h3" /><path d="m18 4 3 3-3 3M18 14l3 3-3 3" /></svg></button>
                  </div>
                )}
              </div>
            )}
          </div>
          {ed.showNav && (
            <div style={{ display: 'flex', gap: 12, padding: '0 24px 22px' }}>
              <button onClick={ed.prev} style={{ flex: '0 0 30%', height: 50, borderRadius: 12, background: '#f3ead8', border: '1.5px solid #dccdb2', fontSize: 15, fontWeight: 700, color: '#4a4560', cursor: 'pointer', boxShadow: 'inset 0 -3px 0 #e2d4ba,inset 0 1px 0 #fff' }}>{ed.prevLabel}</button>
              <button onClick={ed.next} style={ed.nextStyle}>{ed.nextLabel}</button>
            </div>
          )}
        </div>
        {v.hasToast && <div style={{ position: 'fixed', left: '50%', top: 76, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderRadius: 12, background: '#2b2d55', color: '#fff', fontSize: 14, fontWeight: 700, boxShadow: 'inset 0 -3px 0 #17183a,0 16px 30px -12px rgba(23,24,58,.7)', zIndex: 400, whiteSpace: 'nowrap' }}><span style={{ font: '12px Galmuri11', color: '#f0c04a' }}>✦</span>{v.toast}</div>}
      </div>
    );
  }
}

export class SettingsView extends ReferenceView {
  render() {
    const v = this.renderVals();
    if (!v.showSettings) return null;
    return (
      <div onClick={v.closeModal} style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(41,40,63,.46)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div onClick={v.stop} style={{ width: 'min(720px,100%)', maxHeight: '100%', overflow: 'auto', background: '#fbf7ef', borderRadius: 22, boxShadow: '0 0 0 2px #3b3e6e,inset 0 1px 0 #fff,0 30px 70px -20px rgba(0,0,0,.7)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 24px 14px', borderBottom: '1px solid #efe6d5' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}><span style={{ fontSize: 12.5, fontWeight: 700, color: '#8a8499' }}>프로필 › 설정</span><span style={{ fontSize: 20, fontWeight: 800 }}>알림 설정</span></div>
            <button onClick={v.closeModal} style={{ width: 34, height: 34, borderRadius: 10, border: '1.5px solid #e2d6c2', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4560' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          </div>
          <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14, background: '#fff', border: '1px solid #ece2cf', boxShadow: '0 2px 0 #ece2cf' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}><span style={{ fontSize: 15, fontWeight: 800 }}>웹 알림 받기</span><span style={{ fontSize: 12.5, color: '#8a8499' }}>선택한 알림만 브라우저 알림으로 보내드려요 · 권한: <b style={v.permStyle}>{v.permLabel}</b></span></span>
              {v.needPerm && <button onClick={v.askPerm} style={{ height: 34, padding: '0 12px', borderRadius: 9, border: '1.5px solid #8b7fe0', background: '#ece8fb', color: '#4b3fb8', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>권한 허용하기</button>}
              <button onClick={v.toggleMaster} style={v.masterStyle}><span style={v.masterKnob} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#5d5870' }}>어떤 알림을 받을까요?</span>
              <div style={{ background: '#fff', border: '1px solid #ece2cf', borderRadius: 14, boxShadow: '0 2px 0 #ece2cf', overflow: 'hidden' }}>
                {v.notifRows.map((nr, i) => (
                  <button key={i} onClick={nr.onClick} style={nr.rowStyle}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: '#f6f0e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><img src={nr.icon} alt="" style={{ height: 15, width: 19, objectFit: 'contain', imageRendering: 'pixelated' }} /></span>
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}><span style={{ fontSize: 14, fontWeight: 800 }}>{nr.title}</span><span style={{ fontSize: 12.5, color: '#8a8499' }}>{nr.desc}</span></span>
                    <span style={nr.box}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg></span>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#5d5870', width: 72 }}>받는 범위</span>
              <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', flex: 1, background: '#efe6d5', borderRadius: 10, padding: 3 }}>{v.scopeBtns.map((sb, i) => <button key={i} onClick={sb.onClick} style={sb.style}>{sb.label}</button>)}</span>
            </div>
            <button onClick={v.toggleQuiet} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13.5, color: '#4a4560', fontWeight: 600 }}>
              <span style={v.quietBox}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg></span>'집중 근무 중'일 때는 알림 잠시 멈추기
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10, padding: '0 24px 22px' }}>
            <button onClick={v.testNotif} style={{ whiteSpace: 'nowrap', height: 48, padding: '0 18px', borderRadius: 12, background: '#f3ead8', border: '1.5px solid #dccdb2', fontSize: 14, fontWeight: 700, color: '#4a4560', cursor: 'pointer', boxShadow: 'inset 0 -3px 0 #e2d4ba' }}>테스트 알림 보내기</button>
            <button onClick={v.saveSettings} style={{ flex: 1, height: 48, border: 'none', borderRadius: 12, background: '#2b2d55', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: 'inset 0 -4px 0 #17183a' }}>저장</button>
          </div>
        </div>
      </div>
    );
  }
}
