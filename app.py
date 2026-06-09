import os
from typing import TypedDict
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
import re

# 1. Load API keys
load_dotenv()

# Retrieve the key from the environment explicitly
api_key = os.getenv("GOOGLE_API_KEY")

# 2. Define the Shared Whiteboard (State) with Short-Term Memory
class ResearchState(TypedDict):
    topic: str
    research_notes: str
    verified_facts: str
    draft: str
    critique: str
    score: int            
    revision_count: int   

# Initialize our LLM with the standard model name format
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-pro", 
    temperature=0,
    max_retries=5,       # 🔄 Automatically retry up to 5 times if the server fails
    timeout=60           # ⏱️ Give the server up to 60 seconds to respond
)

# --- AGENT 1: THE RESEARCHER ---
def researcher_agent(state: ResearchState):
    # Check if this is a revision loop or a first run
    rev_count = state.get('revision_count', 0)
    topic = state['topic']
    
    if rev_count > 0:
        print(f"\n🔄 [Researcher] Loop #{rev_count}: Revising based on critique...")
        prompt = f"""You are an expert researcher. Your previous research was critiqued as follows:
        {state['critique']}
        
        Go back and find more specific details, numbers, or context to patch these gaps for the topic: '{topic}'."""
    else:
        print("\n🚀 [Researcher] Gathering initial notes...")
        prompt = f"""You are an expert researcher. Gather comprehensive historical context, 
        key figures, and core concepts regarding the topic: '{topic}'. 
        Provide raw, detailed bullet points of your findings."""
    
    response = llm.invoke(prompt)
    # Append new findings to old notes if it's a loop, otherwise create fresh
    combined_notes = state.get('research_notes', '') + "\n" + response.content if rev_count > 0 else response.content
    
    return {"research_notes": combined_notes, "revision_count": rev_count + 1}


# --- AGENT 2: THE VERIFIER ---
def verifier_agent(state: ResearchState):
    print("\n🔍 [Verifier] Checking facts and data integrity...")
    notes = state['research_notes']
    
    prompt = f"""You are a meticulous fact-checker. Review the following research notes:
    ---
    {notes}
    ---
    Output a revised, verified version of the notes."""
    
    response = llm.invoke(prompt)
    return {"verified_facts": response.content}


# --- AGENT 3: THE SUMMARIZER ---
def summarizer_agent(state: ResearchState):
    print("\n✍️ [Summarizer] Compiling into an elegant brief...", flush=True)
    facts = state['verified_facts']
    critique = state.get('critique', '') # 👈 Pulls in the design instructions!
    
    prompt = f"""You are an expert technical writer. Synthesize these verified facts into a polished, structured brief:
    ---
    {facts}
    ---
    
    CRITICAL TONE AND FORMATTING DIRECTIVES:
    You must strictly follow any stylistic edits, structural changes, tone adjustments, or specific title requests detailed in the critique log below. Cut all conversational filler and academic preamble.
    
    Critique Log:
    {critique}"""
    
    response = llm.invoke(prompt)
    return {"draft": response.content}


# --- AGENT 4: THE CRITIC ---
def critic_agent(state: ResearchState):
    print("\n⚖️ [Critic] Evaluating final quality...", flush=True)
    draft = state['draft']
    
    prompt = f"""You are a ruthless editor. Critique the following draft brief:
    ---
    {draft}
    ---
    Your response MUST include a quality score formatted exactly like this:
    SCORE: X (where X is a whole number between 1 and 10)
    Then provide your detailed explanation of gaps below it."""
    
    response = llm.invoke(prompt)
    critique_text = response.content
    
    # 🛡️ Bulletproof Regex Extraction: Finds "SCORE: X" anywhere in the text
    match = re.search(r"SCORE:\s*(\d+)", critique_text, re.IGNORECASE)
    if match:
        score = int(match.group(1))
    else:
        print("⚠️ [Warning] Critic missed format. Searching for standalone numbers...")
        # Fallback: look for any number 1-10 in the first couple lines
        numbers = re.findall(r"\b([1-9]|10)\b", critique_text.split("\n")[0])
        score = int(numbers[0]) if numbers else 5  # Absolute fallback
        
    print(f"📊 [Critic] Awarded a Quality Score of: {score}/10", flush=True)
    
    return {"critique": critique_text, "score": score}


# --- 🚦 ROUTING LOGIC (The Smart Switch) ---
def should_continue(state: ResearchState):
    score = state["score"]
    rev_count = state["revision_count"]
    
    # If the score is high enough, OR we've already looped 5 times, we stop.
    if score >= 8 or rev_count >= 5:
        print("\n✅ Quality threshold met or max revisions reached. Ending workflow.")
        return "end"
    else:
        print(f"\n❌ Score ({score}/10) is too low. Routing back to Researcher.")
        return "loop"


# 4. Build the Orchestration Graph
workflow = StateGraph(ResearchState)

# Register nodes
workflow.add_node("researcher", researcher_agent)
workflow.add_node("verifier", verifier_agent)
workflow.add_node("summarizer", summarizer_agent)
workflow.add_node("critic", critic_agent)

# Set up sequential pipelines
workflow.set_entry_point("researcher")
workflow.add_edge("researcher", "verifier")
workflow.add_edge("verifier", "summarizer")
workflow.add_edge("summarizer", "critic")

# Dynamic router
workflow.add_conditional_edges(
    "critic",
    should_continue,
    {
        "loop": "researcher",  
        "end": END            
    }
)

memory = MemorySaver()

# Interrupt configuration setup
app = workflow.compile(
    checkpointer=memory,
    interrupt_after=["critic"]  # Pauses AFTER the critic grades, right before the loop splits!
)

# 5. Test Run
if __name__ == "__main__":
    initial_state = {
        "topic": "Recent developments in solid-state battery technology for EVs",
        "research_notes": "",
        "verified_facts": "",
        "draft": "",
        "critique": "",
        "score": 0,
        "revision_count": 0
    }
    
    config = {"configurable": {"thread_id": "research_session_v4"}}
    print("Starting Multi-Agent System with Smart Loop...", flush=True)
    
    # Run initial pipeline completely
    events = app.stream(initial_state, config, stream_mode="values")
    for event in events:
        # This keeps the stream moving explicitly
        pass
        
    while True:
        state = app.get_state(config)
        
        if not state.next:
            print("\n✅ Workflow complete!")
            break
            
        current_score = state.values.get('score', 0)
        rev_count = state.values.get('revision_count', 0)
        
        if current_score >= 8 or rev_count >= 5:
            print("\n✅ Hard limit or threshold met. Shutting down system.")
            break
            
        print("\n🛑 [HUMAN INTERRUPT] Critique complete. Reviewing loop conditions...", flush=True)
        print(f"📋 Current Score: {current_score}/10")
        print(f"💬 Critic's Feedback:\n{state.values.get('critique')}\n", flush=True)
        
        user_input = input("⌨️ Enter extra instructions for the Researcher (or press Enter to run automatically): ")
        
        if user_input.strip():
            updated_critique = f"{state.values.get('critique')}\n\n[ADDITIONAL HUMAN DIRECTIVE]: {user_input}"
            app.update_state(config, {"critique": updated_critique}, as_node="critic")
            print("📝 Human feedback injected!")
        
        print("\n🚀 Resuming workflow execution for next loop...", flush=True)
        
        # Stream the recovery sequence safely
        for event in app.stream(None, config, stream_mode="values"):
            pass