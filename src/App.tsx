import { FormEvent, useState } from "react";
import "./App.css";
import Table from "./components/Table";
import { TrackingTable } from "./types/TrackingTable";



function App() {
  const [trackingTable, setTrackingTable] = useState<TrackingTable | null>(null);


  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const newTrackingTable: TrackingTable = {
      days: 0,
      goals: [],
      id: 'dasdas',
      userId: ''

    };
    setTrackingTable(newTrackingTable)
  }

  if(!!trackingTable){
    return <Table />
  }

  return (
    <div className="site-container">
      <header>
        <img className="image" src="braces.svg" alt="braces logo" />
        <p>Reach your goals</p>
      </header>
      <main>
        <h1>
          Getting things done by <span className="underline">tracking your progress</span>
        </h1>
        <div className="content">
          <p>To create a personalized table for you, please:</p>
          <ol>
            <li>
              enter the number of days you are committed to. According to research it should be at
              least 67 days if you wish to make it a habit.
            </li>
            <li>
              enter the goals you want to stick to every day. It is recommended to have no more than
              1-3 goals at a time. If you are a beginner, start with one &#128540;
            </li>
          </ol>
        </div>
        <form className="form" onSubmit={onSubmit}>
          <div className="input-container">
            <label htmlFor="days-input">Number of days (default value is set)</label>
            <input defaultValue="67" id="days-input" type="number" />
          </div>
          <div className="input-container">
            <label htmlFor="goal1"> Daily goal #1</label>
            <textarea placeholder="5 pushups, 3 pullups, 10 sqats" name="" id="goal1"></textarea>
          </div>
          <button type="button" className="btn secondary">
            Add another goal <span aria-hidden>+</span>
          </button>
          <button type="submit" className="btn primary">
            Create tracking table
          </button>
        </form>
      </main>
      <footer>
        <p>Created by e11i</p>
      </footer>
    </div>
  );
}

export default App;
