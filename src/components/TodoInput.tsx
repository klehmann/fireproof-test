import React, { useState } from 'react';

interface TodoInputProps {
  onAddTodo: (text: string) => void;
}

export const TodoInput: React.FC<TodoInputProps> = ({ onAddTodo }) => {
  const [newTodoText, setNewTodoText] = useState("");

  const handleAddTodo = () => {
    if (!newTodoText.trim()) return;
    onAddTodo(newTodoText.trim());
    setNewTodoText("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTodo();
    }
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <input
        type="text"
        value={newTodoText}
        onChange={(e) => setNewTodoText(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Add a new todo..."
        style={{
          padding: '10px',
          fontSize: '16px',
          width: '70%',
          marginRight: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}
      />
      <button
        onClick={handleAddTodo}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Add Todo
      </button>
    </div>
  );
};
