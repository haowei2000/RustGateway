/* Keys / Config / Audit views. Reuses helpers from window.Views. */
(function () {
  const A = window.AdminUI;
  const Icon = window.Icon;
  const { useState } = React;
  const D = window.DATA;
  const V = window.Views;
  const { Tip, IconBtn, Dot, Field, Section, RowItem, ListPanel, MetricCard, DetailHead } = V;

  /* ---------------------------------- Keys --------------------------------- */
  function Keys() {
    const [sel, setSel] = useState(D.KEYS[0].id);
    const [copied, setCopied] = useState(false);
    const k = D.KEYS.find(x => x.id === sel);
    function copy() { setCopied(true); setTimeout(() => setCopied(false), 1200); }

    return (
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <ListPanel title="API Keys" count={D.KEYS.length}>
          {D.KEYS.map(x => (
            <RowItem key={x.id} icon="keyRound" title={x.name} subtitle={x.prefix + "···· · " + x.reqs + " req"}
              selected={x.id === sel} onClick={() => setSel(x.id)} trail={<Dot status={x.status} />} />
          ))}
        </ListPanel>

        <div className="scroll fade-in" key={sel} style={{ flex: 1, minWidth: 0 }}>
          <DetailHead icon="keyRound" title={k.name} tag={k.scopes.length ? k.scopes.join(" · ") : "no scope"} status={k.status}
            actions={<>
              <IconBtn icon="rotateCw" tip="Rotate key" pos="down" />
              <IconBtn icon="trash" tip="Revoke key" pos="down" danger />
              <A.Button size="sm"><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="save" size={15} /> Save</span></A.Button>
            </>} />

          <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 920 }}>
            <Section title="Credential">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label="Secret key" mono>
                  <span style={{ flex: 1 }}>{k.prefix}····················</span>
                  <IconBtn icon={copied ? "check" : "copy"} tip={copied ? "Copied" : "Copy"} pos="left" size={15} onClick={copy} />
                </Field>
                <div style={{ display: "flex", gap: 14 }}>
                  <Field label="Owner team" grow>{k.owner}</Field>
                  <Field label="Created">{k.created}</Field>
                  <Field label="Last used">{k.lastUsed}</Field>
                </div>
              </div>
            </Section>

            <Section title="Limits & scopes">
              <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <MetricCard label="Rate limit" value={k.rpm ? k.rpm.toLocaleString() : "—"} sub="req / min" accent="var(--ix)" />
                <MetricCard label="Lifetime requests" value={k.reqs} accent="var(--ix)" />
                <MetricCard label="Status" value={k.status} accent={V.SC[k.status]} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", margin: "0 0 8px" }}>Allowed scopes</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["chat", "embed", "rerank", "admin"].map(s => {
                  const on = k.scopes.includes(s);
                  return (
                    <span key={s} style={{
                      display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 8,
                      fontSize: 13, fontWeight: 550, cursor: "pointer",
                      background: on ? "var(--secondary)" : "transparent",
                      color: on ? "#34374C" : "var(--muted-foreground)",
                      border: "1px solid " + (on ? "transparent" : "var(--hair)"),
                    }}>
                      <Icon name={on ? "check" : "plus"} size={13} /> {s}
                    </span>
                  );
                })}
              </div>
            </Section>

            <Section title="Danger zone" defaultOpen={false}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "rgba(238,43,71,0.06)", borderRadius: 10 }}>
                <Icon name="alertTriangle" size={18} style={{ color: "#EE2B47" }} />
                <div style={{ flex: 1, fontSize: 13, color: "var(--muted-foreground)" }}>Revoking immediately blocks all traffic using this key. This cannot be undone.</div>
                <A.Button size="sm" variant="destructive">Revoke</A.Button>
              </div>
            </Section>
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------------- Config -------------------------------- */
  function Switch({ on, onClick }) {
    return <button className={"sw" + (on ? " on" : "")} onClick={onClick} aria-pressed={on} />;
  }

  function ConfigRow({ title, desc, children }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: "1px solid var(--hair2)" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
          {desc && <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 2 }}>{desc}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>{children}</div>
      </div>
    );
  }

  function NumBox({ value, unit, w = 96 }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input defaultValue={value} className="tnum" style={{
          width: w, padding: "8px 11px", border: "1px solid var(--hair)", borderRadius: 8, background: "#fff",
          fontSize: 14, fontFamily: "var(--mono)", color: "#34374C", textAlign: "right",
        }} />
        {unit && <span style={{ fontSize: 12.5, color: "var(--muted-foreground)", width: 44 }}>{unit}</span>}
      </div>
    );
  }

  function Config() {
    const c = D.CONFIG;
    const [cache, setCache] = useState(c.cache.enabled);
    const [semantic, setSemantic] = useState(c.cache.semantic);
    const [perKey, setPerKey] = useState(c.rate.perKey);
    const [breaker, setBreaker] = useState(c.breaker.enabled);
    const [fb, setFb] = useState(c.fallback);
    function toggleFb(id) { setFb(fb.map(f => f.id === id ? { ...f, on: !f.on } : f)); }

    return (
      <div className="scroll fade-in" style={{ flex: 1, minHeight: 0 }}>
        <DetailHead icon="sliders" title="Gateway configuration" tag="global"
          actions={<>
            <IconBtn icon="rotateCw" tip="Reset to defaults" pos="down" />
            <A.Button size="sm"><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="save" size={15} /> Save changes</span></A.Button>
          </>} />

        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 820 }}>
          <Section title="Rate limiting">
            <ConfigRow title="Requests per minute" desc="Hard ceiling across the gateway"><NumBox value={c.rate.rpm} unit="req/min" /></ConfigRow>
            <ConfigRow title="Tokens per minute" desc="Aggregate prompt + completion tokens"><NumBox value={c.rate.tpm} unit="tok/min" w={120} /></ConfigRow>
            <ConfigRow title="Burst allowance" desc="Short spikes above the steady rate"><NumBox value={c.rate.burst} unit="req" /></ConfigRow>
            <ConfigRow title="Per-key enforcement" desc="Apply limits to each API key independently"><Switch on={perKey} onClick={() => setPerKey(!perKey)} /></ConfigRow>
          </Section>

          <Section title="Caching" right={<Switch on={cache} onClick={() => setCache(!cache)} />}>
            <div style={{ opacity: cache ? 1 : 0.45, pointerEvents: cache ? "auto" : "none", transition: "opacity .15s" }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
                <MetricCard label="Cache hit rate" value={c.cache.hitRate + "%"} accent="#1f9d57" />
                <MetricCard label="Store size" value={c.cache.max + " MB"} accent="var(--ix)" />
              </div>
              <ConfigRow title="TTL" desc="How long a cached completion stays valid"><NumBox value={c.cache.ttl} unit="sec" /></ConfigRow>
              <ConfigRow title="Semantic cache" desc="Match on embedding similarity, not exact text"><Switch on={semantic} onClick={() => setSemantic(!semantic)} /></ConfigRow>
            </div>
          </Section>

          <Section title="Fallback & resilience">
            <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginBottom: 10 }}>Drag to reorder. When an upstream fails, the gateway retries the next enabled provider in order.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {fb.map((f, i) => (
                <div key={f.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 9,
                  background: f.on ? "var(--muted)" : "transparent", border: "1px solid " + (f.on ? "transparent" : "var(--hair)"),
                  opacity: f.on ? 1 : 0.6,
                }}>
                  <Tip label="Drag to reorder" pos="right"><span style={{ color: "var(--muted-foreground)", cursor: "grab", display: "inline-flex" }}><Icon name="grip" size={16} /></span></Tip>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--ix)", color: "var(--ixc)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 550, flex: 1 }}>{f.name}</span>
                  <Switch on={f.on} onClick={() => toggleFb(f.id)} />
                </div>
              ))}
            </div>
            <ConfigRow title="Max retries" desc="Attempts before returning an error to the caller"><NumBox value={c.retry.max} unit="tries" /></ConfigRow>
            <ConfigRow title="Backoff" desc="Delay between retry attempts"><NumBox value={c.retry.backoff} unit="ms" /></ConfigRow>
          </Section>

          <Section title="Circuit breaker" right={<Switch on={breaker} onClick={() => setBreaker(!breaker)} />}>
            <div style={{ opacity: breaker ? 1 : 0.45, pointerEvents: breaker ? "auto" : "none", transition: "opacity .15s" }}>
              <ConfigRow title="Error threshold" desc="Trip the breaker above this failure rate"><NumBox value={c.breaker.threshold} unit="%" /></ConfigRow>
              <ConfigRow title="Cooldown" desc="Time before probing the upstream again"><NumBox value={c.breaker.cooldown} unit="sec" /></ConfigRow>
            </div>
          </Section>
        </div>
      </div>
    );
  }

  /* --------------------------------- Audit --------------------------------- */
  const ACT = { create: "#1f9d57", update: "var(--ix)", rotate: "#c98a12", disable: "rgba(52,55,76,0.5)", delete: "#EE2B47" };
  function statusColor(s) { return s >= 500 ? "#EE2B47" : s === 429 ? "#c98a12" : "#1f9d57"; }

  function Audit() {
    const [tab, setTab] = useState("ops");
    const [open, setOpen] = useState(null);
    const tabs = [
      { id: "ops", label: "Operation log", icon: "scroll" },
      { id: "trace", label: "Request traces", icon: "activity" },
    ];

    return (
      <div className="fade-in" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 22px 0", background: "#fff", borderBottom: "1px solid var(--hair)" }}>
          <h1 style={{ margin: "0 8px 0 0", fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>Audit</h1>
          <div style={{ display: "flex", gap: 4, alignSelf: "flex-end" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 14px", border: 0, background: "transparent",
                cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: tab === t.id ? "#34374C" : "var(--muted-foreground)",
                borderBottom: "2px solid " + (tab === t.id ? "var(--ix)" : "transparent"), marginBottom: -1,
              }}>
                <Icon name={t.icon} size={15} /> {t.label}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", paddingBottom: 8 }}>
            <IconBtn icon="filter" tip="Filter" pos="downr" />
            <IconBtn icon="search" tip="Search" pos="downr" />
          </div>
        </header>

        <div className="scroll" key={tab} style={{ flex: 1, padding: "16px 22px", minHeight: 0 }}>
          {tab === "ops" ? (
            <div style={{ background: "#fff", border: "1px solid var(--hair)", borderRadius: 12, overflow: "hidden" }}>
              <A.Table>
                <A.TableHeader>
                  <A.TableRow>
                    <A.TableHead>When</A.TableHead>
                    <A.TableHead>Actor</A.TableHead>
                    <A.TableHead>Action</A.TableHead>
                    <A.TableHead>Target</A.TableHead>
                    <A.TableHead>Change</A.TableHead>
                    <A.TableHead></A.TableHead>
                  </A.TableRow>
                </A.TableHeader>
                <A.TableBody>
                  {D.AUDIT_OPS.map(o => (
                    <A.TableRow key={o.id}>
                      <A.TableCell className="tnum" style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{o.date} · {o.time}</A.TableCell>
                      <A.TableCell><span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 600 }}><span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--secondary)", display: "grid", placeItems: "center" }}><Icon name="user" size={12} /></span>{o.actor}</span></A.TableCell>
                      <A.TableCell><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, textTransform: "capitalize", color: ACT[o.action] }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: ACT[o.action] }} />{o.action}</span></A.TableCell>
                      <A.TableCell style={{ fontWeight: 550 }}>{o.target}</A.TableCell>
                      <A.TableCell style={{ color: "var(--muted-foreground)", fontFamily: "var(--mono)", fontSize: 12.5 }}>
                        {o.field === "—" ? "—" : <><span style={{ textDecoration: "line-through", opacity: 0.6 }}>{o.before}</span> <span style={{ color: "var(--ix)" }}>→ {o.after}</span></>}
                      </A.TableCell>
                      <A.TableCell><div style={{ display: "flex", justifyContent: "flex-end" }}><IconBtn icon="chevronRight" tip="Inspect" pos="left" size={15} onClick={() => setOpen(o)} /></div></A.TableCell>
                    </A.TableRow>
                  ))}
                </A.TableBody>
              </A.Table>
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid var(--hair)", borderRadius: 12, overflow: "hidden" }}>
              <A.Table>
                <A.TableHeader>
                  <A.TableRow>
                    <A.TableHead>Time</A.TableHead>
                    <A.TableHead>Key</A.TableHead>
                    <A.TableHead>Model</A.TableHead>
                    <A.TableHead>Upstream</A.TableHead>
                    <A.TableHead>Tokens</A.TableHead>
                    <A.TableHead>Latency</A.TableHead>
                    <A.TableHead>Status</A.TableHead>
                  </A.TableRow>
                </A.TableHeader>
                <A.TableBody>
                  {D.TRACES.map(t => (
                    <A.TableRow key={t.id}>
                      <A.TableCell className="tnum" style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{t.time}</A.TableCell>
                      <A.TableCell style={{ fontWeight: 550 }}>{t.key}</A.TableCell>
                      <A.TableCell style={{ fontFamily: "var(--mono)", fontSize: 12.5 }}>{t.model}</A.TableCell>
                      <A.TableCell style={{ color: "var(--muted-foreground)" }}>{t.provider}</A.TableCell>
                      <A.TableCell className="tnum" style={{ color: "var(--muted-foreground)" }}>{t.tin} / {t.tout}</A.TableCell>
                      <A.TableCell className="tnum" style={{ fontWeight: 600 }}>{t.lat} ms</A.TableCell>
                      <A.TableCell><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontFamily: "var(--mono)", fontSize: 12.5, color: statusColor(t.status) }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor(t.status) }} />{t.status}</span></A.TableCell>
                    </A.TableRow>
                  ))}
                </A.TableBody>
              </A.Table>
            </div>
          )}
        </div>

        {open && <AuditDrawer op={open} onClose={() => setOpen(null)} />}
      </div>
    );
  }

  function AuditDrawer({ op, onClose }) {
    return (
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,21,30,0.32)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}>
        <div onClick={e => e.stopPropagation()} className="scroll" style={{
          width: 460, maxWidth: "92vw", height: "100%", background: "#fff", boxShadow: "-16px 0 48px rgba(0,0,0,0.18)",
          animation: "fade .2s ease both", padding: "20px 22px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 700, textTransform: "capitalize", color: ACT[op.action] }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: ACT[op.action] }} />{op.action}
            </span>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{op.target}</h2>
            <IconBtn icon="x" tip="Close" pos="left" onClick={onClose} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 14 }}>
              <Field label="Actor" grow>{op.actor}</Field>
              <Field label="Timestamp">{op.date} · {op.time}</Field>
            </div>
            <Field label="Field" grow>{op.field}</Field>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", margin: "0 0 6px" }}>Diff</div>
              <div style={{ borderRadius: 8, overflow: "hidden", fontFamily: "var(--mono)", fontSize: 13 }}>
                <div style={{ padding: "10px 13px", background: "rgba(238,43,71,0.07)", color: "#34374C" }}>− {op.before}</div>
                <div style={{ padding: "10px 13px", background: "rgba(31,157,87,0.10)", color: "#34374C" }}>+ {op.after}</div>
              </div>
            </div>
            <Field label="Request ID" mono grow>req_{op.id}9f3c204e8a</Field>
          </div>
        </div>
      </div>
    );
  }

  window.Views = Object.assign(window.Views || {}, { Keys, Config, Audit });
})();
