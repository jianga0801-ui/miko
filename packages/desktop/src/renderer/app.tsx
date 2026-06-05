import { createResource, createSignal, For, Show } from "solid-js"
import { client } from "./sdk"

export function App() {
  const [sessions, { refetch: refetchSessions }] = createResource(async () => {
    const res = await client.session.list()
    return res.data ?? []
  })
  const [activeId, setActiveId] = createSignal<string>()

  // session.messages returns Array<{ info: Message; parts: Part[] }>
  const [messages] = createResource(activeId, async (id) => {
    const res = await client.session.messages({ path: { id } })
    return res.data ?? []
  })

  async function newSession() {
    const res = await client.session.create()
    await refetchSessions()
    setActiveId(res.data!.id)
  }

  return (
    <div style={{ display: "flex", height: "100vh", "font-family": "sans-serif" }}>
      <aside style={{ width: "260px", "border-right": "1px solid #333", padding: "12px", overflow: "auto" }}>
        <button onClick={newSession}>+ 新建会话</button>
        <For each={sessions()}>
          {(s) => (
            <div
              onClick={() => setActiveId(s.id)}
              style={{ padding: "6px", cursor: "pointer", background: activeId() === s.id ? "#222" : "transparent" }}
            >
              {s.title}
            </div>
          )}
        </For>
      </aside>
      <main style={{ flex: 1, padding: "16px", overflow: "auto" }}>
        <Show when={activeId()} fallback={<p>选择或新建一个会话</p>}>
          <For each={messages()}>
            {(m) => (
              <pre style={{ "white-space": "pre-wrap", "border-bottom": "1px solid #222", padding: "8px 0" }}>
                {JSON.stringify(m, null, 2)}
              </pre>
            )}
          </For>
        </Show>
      </main>
    </div>
  )
}
