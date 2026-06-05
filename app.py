import os
from typing import TypedDict
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END

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
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0, google_api_key=api_key)

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
    print("\n✍️ [Summarizer] Compiling into an elegant brief...")
    facts = state['verified_facts']
    
    prompt = f"""Synthesize these verified facts into a polished, structured technical brief:
    ---
    {facts}"""
    
    response = llm.invoke(prompt)
    return {"draft": response.content}


# --- AGENT 4: THE CRITIC ---
def critic_agent(state: ResearchState):
    print("\n⚖️ [Critic] Evaluating final quality...")
    draft = state['draft']
    
    # We ask the LLM to output a raw score on the first line to make parsing easy
    prompt = f"""You are a ruthless editor. Critique the following draft brief:
    ---
    {draft}
    ---
    Your response MUST start with a score on the very first line format exactly like this:
    SCORE: X (where X is a number between 1 and 10)
    Then provide your detailed explanation of gaps below it."""
    
    response = llm.invoke(prompt)
    critique_text = response.content
    
    # Extract the score from the LLM text output
    try:
        score_line = critique_text.split("\n")[0]
        score = int(score_line.split("SCORE:")[1].strip())
    except:
        score = 5 # Default fallback score if the format gets missed
        
    print(f"📊 [Critic] Awarded a Quality Score of: {score}/10")
    
    return {"critique": critique_text, "score": score}


# --- 🚦 ROUTING LOGIC (The Smart Switch) ---
def should_continue(state: ResearchState):
    score = state["score"]
    rev_count = state["revision_count"]
    
    # If the score is high enough, OR we've already looped 3 times, we stop.
    if score >= 8 or rev_count >= 3:
        print("\n✅ Quality threshold met or max revisions reached. Ending workflow.")
        return "end"
    else:
        print(f"\n❌ Score ({score}/10) is too low. Routing back to Researcher.")
        return "loop"


# 4. Build the Orchestration Graph
workflow = StateGraph(ResearchState)

# Step 4a: Register our nodes
workflow.add_node("researcher", researcher_agent)
workflow.add_node("verifier", verifier_agent)
workflow.add_node("summarizer", summarizer_agent)
workflow.add_node("critic", critic_agent)

# Step 4b: Set up the sequential pipelines and conditional edge
workflow.set_entry_point("researcher")
workflow.add_edge("researcher", "verifier")
workflow.add_edge("verifier", "summarizer")
workflow.add_edge("summarizer", "critic")

# Dynamic router: After Critic, look at 'should_continue' to decide where to go next
workflow.add_conditional_edges(
    "critic",
    should_continue,
    {
        "loop": "researcher",  # If router says 'loop', go back to researcher node
        "end": END            # If router says 'end', finish up
    }
)

app = workflow.compile()

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
    
    print("Starting Multi-Agent System with Smart Loop...")
    final_output = app.invoke(initial_state)
    
    print("\n=============================================")
    print("🏁 FINAL SYSTEM OUTPUT (DRAFT):")
    print("=============================================")
    print(final_output["draft"])