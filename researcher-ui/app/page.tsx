"use client";

import React, { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Play, RotateCw, CheckCircle, AlertTriangle, Send, BookOpenText, Search, FileText, BotMessageSquare, BrainCircuit, X } from "lucide-react";

type AgentNode = "researcher" | "verifier" | "summarizer" | "critic" | "interrupt" | "complete" | "";

export default function Dashboard() {
  const [topic, setTopic] = useState("Recent developments in solid-state battery technology for EVs");
  const [threadId, setThreadId] = useState("research_session_web");
  const [currentNode, setCurrentNode] = useState<AgentNode>("");
  const [score, setScore] = useState<number | null>(null);
  const [revisionCount, setRevisionCount] = useState<number>(0);
  const [draft, setDraft] = useState<string>("");
  const [critique, setCritique] = useState<string>("");
  const [humanInput, setHumanInput] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [showInterruptModal, setShowInterruptModal] = useState<boolean>(false);

  const appendLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleStreamData = (event: MessageEvent) => {
    try {
      const parsed = JSON.parse(event.data);
      const { node, data, state } = parsed;

      if (node) {
        setCurrentNode(node);
      }

      if (node === "researcher" && data?.research_notes) {
        appendLog("Researcher completed initial gathering.");
      } else if (node === "verifier" && data?.verified_facts) {
        appendLog("Verifier successfully double-checked data integrity.");
      } else if (node === "summarizer" && data?.draft) {
        setDraft(data.draft);
        appendLog("Summarizer compiled a new technical draft.");
      } else if (node === "critic") {
        if (data?.score !== undefined) setScore(data.score);
        if (data?.revision_count !== undefined) setRevisionCount(data.revision_count);
        if (data?.critique) setCritique(data.critique);
        appendLog(`Critic finished evaluation. Score given: ${data?.score ?? "?"}/10`);
      }

      if (node === "interrupt") {
        setIsLive(false);
        if (state) {
          setScore(state.score);
          setRevisionCount(state.revision_count);
          setDraft(state.draft);
          setCritique(state.critique);
        }
        appendLog("⚠️ Pipeline paused: Awaiting human feedback parameters.");
        setShowInterruptModal(true);
      } else if (node === "complete") {
        setIsLive(false);
        if (state) setDraft(state.draft);
        appendLog("🎉 Success! Quality threshold met or maximum loops exhausted.");
      }
    } catch (err) {
      // Catch bad formatting or stringified server errors gracefully
      console.error("Failed to parse stream segment:", err);
      appendLog("⚠️ Stream parsing warning: Received an unformatted data packet from engine.");
    }
  };

  const startResearch = async () => {
    if (!topic.trim()) return;
    setIsLive(true);
    setShowInterruptModal(false);
    setLogs([]);
    setDraft("");
    setCritique("");
    setScore(null);
    setCurrentNode("researcher");
    appendLog(`Initializing research workflow for topic: "${topic}"`);

    const url = "http://localhost:8000/api/research/start";
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, thread_id: threadId }),
      });

      if (!response.body) {
        appendLog("Error: Backend returned an empty response.");
        setIsLive(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let unparsedBuffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        unparsedBuffer += decoder.decode(value, { stream: true });
        const lines = unparsedBuffer.split("\n");
        unparsedBuffer = lines.pop() || "";

        for (const line of lines) {
          const cleanedLine = line.trim();
          if (cleanedLine.startsWith("data: ")) {
            const rawJson = cleanedLine.slice(6);
            handleStreamData({ data: rawJson } as MessageEvent);
          }
        }
      }
    } catch (err) {
      appendLog("Network error: Verification connection to port 8000 dropped.");
      setIsLive(false);
    }
  };

  // Add a parameter to check if the user chose Auto-Pilot mode
  const resumeResearch = async (isAutoPilot: boolean = false) => {
    setIsLive(true);
    setShowInterruptModal(false);
    
    // Formulate what to send to the backend engine
    // If auto-pilot is checked, we pass the critic's exact text as the instruction
    const payloadInput = isAutoPilot 
      ? `AUTONOMOUS REFINEMENT MODE: The human operator has passed control to you. Read your previous critique meticulously, treat every redline as a mandatory system requirement, and completely rewrite the draft to address your own complaints. Here is your critique to fix: ${critique}`
      : humanInput;

    appendLog(isAutoPilot 
      ? "🤖 Auto-Pilot engaged. Routing Critic's evaluation directly into the optimization engine..." 
      : "Injecting human feedback and resuming engine execution loop..."
    );

    const url = "http://localhost:8000/api/research/resume";
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          thread_id: threadId, 
          user_input: payloadInput // Sends either human text or the auto-pilot loop payload
        }),
      });

      setHumanInput(""); // Clear out the input window

      if (!response.body) {
        setIsLive(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let unparsedBuffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        unparsedBuffer += decoder.decode(value, { stream: true });
        const lines = unparsedBuffer.split("\n");
        unparsedBuffer = lines.pop() || "";

        for (const line of lines) {
          const cleanedLine = line.trim();
          if (cleanedLine.startsWith("data: ")) {
            const rawJson = cleanedLine.slice(6);
            handleStreamData({ data: rawJson } as MessageEvent);
          }
        }
      }
    } catch (err) {
      appendLog("Error resuming research workflow.");
      setIsLive(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-[#1A1D21] flex flex-col font-sans relative">
      
      {/* 🚨 HUMAN STEERING INTERFACE POPUP MODAL */}
      {showInterruptModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-amber-200 shadow-xl overflow-hidden flex flex-col">
            <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-amber-800 font-semibold">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span>Steering Required: Score ({score}/10) below threshold</span>
              </div>
              <button 
                onClick={() => setShowInterruptModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 flex-1">
              <p className="text-sm text-slate-600 leading-relaxed">
                The content synthesis iteration did not meet your established target quality index gate. Provide manual structural directions below, or click **Auto-Pilot** to hand the evaluation notes directly back to the researcher.
              </p>
              <div>
                <label htmlFor="modal-feedback" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Refinement Instructions
                </label>
                <textarea
                  id="modal-feedback"
                  value={humanInput}
                  onChange={(e) => setHumanInput(e.target.value)}
                  placeholder="Tell the researcher what changes to make or what to look for next..."
                  className="w-full h-40 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] text-slate-800 resize-none font-sans"
                />
              </div>
            </div>

            {/* UPDATED MODAL ACTION FOOTER CONTAINER WITH AUTO-PILOT INTEGRATION */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between items-center">
              {/* Left Side Trigger: Auto-Pilot Loop Mode */}
              <button
                onClick={() => resumeResearch(true)}
                className="w-full sm:w-auto bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center justify-center space-x-2 transition-all active:scale-[0.98] border border-slate-800 shadow-sm"
              >
                <BrainCircuit className="h-4 w-4 text-indigo-400" />
                <span>Auto-Pilot (Let Agents Debate)</span>
              </button>

              {/* Right Side Triggers: Manual Human Supervision */}
              <div className="flex w-full sm:w-auto justify-end space-x-3">
                <button
                  onClick={() => setShowInterruptModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Review Current Draft
                </button>
                <button
                  onClick={() => resumeResearch(false)}
                  disabled={!humanInput.trim()}
                  className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold px-5 py-2 rounded-xl flex items-center space-x-2 transition-all active:scale-[0.98]"
                >
                  <Send className="h-4 w-4" />
                  <span>Submit Blueprint Direction</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main App Layout */}
      <header className="border-b border-[#E1E4E8] bg-white px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <BookOpenText className="h-6 w-6 text-[#6366F1]" />
          <h1 className="text-lg font-semibold tracking-tight">AI Strategic Research Assistant</h1>
        </div>
        <div className="flex items-center space-x-3">
          <input
            type="text"
            value={threadId}
            onChange={(e) => setThreadId(e.target.value)}
            className="bg-[#FAFAFA] border border-[#E1E4E8] rounded-full px-4 py-1.5 text-xs text-[#6C757D] font-mono focus:outline-none focus:border-[#6366F1]"
            placeholder="session_id"
            aria-label="Session Thread ID"
            title="Session Thread ID"
            disabled={isLive}
          />
          <span className="text-xs font-medium text-[#6C757D]">Iteration {revisionCount}/5</span>
          {currentNode === "interrupt" && (
            <button 
              onClick={() => setShowInterruptModal(true)}
              className="text-xs bg-amber-50 text-amber-700 border border-amber-200 font-semibold px-3 py-1 rounded-full animate-pulse"
            >
              ⚠️ Awaiting Action
            </button>
          )}
          <div className="h-8 w-8 rounded-full bg-[#E1E4E8] flex items-center justify-center text-sm font-semibold text-[#6C757D]">DG</div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-72 border-r border-[#E1E4E8] bg-[#FAFAFA] p-6 flex flex-col space-y-8 overflow-y-auto">
          <div className="space-y-4">
            <label htmlFor="directive-textarea" className="text-sm font-semibold text-[#1A1D21]">Research Directive</label>
            <textarea
              id="directive-textarea"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isLive}
              className="w-full h-24 bg-white border border-[#E1E4E8] rounded-xl p-4 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1] text-[#343A40] resize-none"
            />
            <button
              onClick={startResearch}
              disabled={isLive}
              className="w-full mt-2 bg-[#6366F1] hover:bg-[#4F46E5] disabled:bg-[#CED4DA] disabled:text-white text-white text-sm font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-sm active:scale-[0.98]"
            >
              {isLive ? <RotateCw className="h-4 w-4 animate-spin"/> : <Play className="h-4 w-4" />}
              <span>{isLive ? "Researching..." : "Start Research"}</span>
            </button>
          </div>

          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-[#1A1D21]">Research Process</h3>
            <div className="relative space-y-4 pl-3">
              <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-[#E1E4E8]"></div>
              {[
                { id: "researcher", name: "Data Gathering", icon: Search },
                { id: "verifier", name: "Fact Verification", icon: BrainCircuit },
                { id: "summarizer", name: "Content Synthesis", icon: FileText },
                { id: "critic", name: "Quality Assurance", icon: BotMessageSquare },
              ].map((step, index) => {
                const isActive = currentNode === step.id;
                const isComplete = (index < ["researcher", "verifier", "summarizer", "critic"].indexOf(currentNode) && currentNode !== "") || currentNode === "complete" || currentNode === "interrupt";
                
                return (
                  <div key={step.id} className="flex items-start space-x-4 relative">
                    <div className={`mt-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 z-10 transition-colors ${isComplete ? "bg-emerald-500 border-emerald-500" : isActive ? "bg-[#6366F1] border-[#6366F1]" : "bg-[#FAFAFA] border-[#CED4DA]"}`}>
                      {isComplete ? <CheckCircle className="h-2.5 w-2.5 text-white"/> : isActive ? <RotateCw className="h-2.5 w-2.5 text-white animate-spin"/> : null}
                    </div>
                    <div className={`flex items-center space-x-3 text-sm font-medium transition-colors ${isActive ? "text-[#1A1D21]" : isComplete ? "text-[#6C757D]" : "text-[#CED4DA]"}`}>
                      <step.icon className={`h-4 w-4 ${isActive ? "text-[#6366F1]" : isComplete ? "text-emerald-500" : "text-[#CED4DA]"}`} />
                      <span>{step.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Canvas: Notion Styled Markdown Workspace */}
        <div className="flex-1 flex flex-col bg-[#FAFAFA] overflow-hidden">
          <div className="flex-1 p-8 md:p-12 lg:p-16 overflow-y-auto scroll-smooth">
            {draft ? (
              <div className="bg-white border border-[#E1E4E8] rounded-2xl p-10 md:p-12 shadow-sm text-slate-800 leading-relaxed text-base max-w-4xl mx-auto prose prose-slate prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-strong:text-slate-900 prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {draft}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-[#CED4DA] italic text-sm">
                Generated strategic research will appear here.
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 border-l border-[#E1E4E8] bg-[#FAFAFA] p-6 flex flex-col space-y-6 overflow-y-auto">
          {score !== null && (
            <div className="bg-white border border-[#E1E4E8] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center space-x-3">
                <FileText className="h-5 w-5 text-[#6C757D]" />
                <h3 className="text-sm font-semibold text-[#1A1D21]">Document Status</h3>
              </div>
              <div className="flex items-center justify-between space-x-3 p-3 bg-[#F8F9FB] rounded-xl border border-[#E1E4E8]">
                {score >= 8 ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle className="mr-1.5 h-3 w-3" /> Approved
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    <AlertTriangle className="mr-1.5 h-3 w-3" /> Needs Revision
                  </span>
                )
                }
                <div className="text-sm font-medium text-[#343A40]">
                  Quality Score: <span className={`font-black text-lg ${score >= 8 ? "text-emerald-600" : "text-amber-600"}`}>{score}</span><span className="text-[#6C757D]">/10</span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white border border-[#E1E4E8] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center space-x-3">
              <BotMessageSquare className="h-5 w-5 text-[#6366F1]" />
              <h3 className="text-sm font-semibold text-[#1A1D21]">Assistant Evaluation</h3>
            </div>
            {critique ? (
              <div className="text-xs leading-relaxed text-[#343A40] whitespace-pre-wrap overflow-y-auto prose prose-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {critique}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="text-[#6C757D] italic text-xs py-4">No strategic evaluation has been generated.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}