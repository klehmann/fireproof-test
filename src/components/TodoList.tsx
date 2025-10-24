import React, { useState } from 'react';

interface Todo {
  _id?: string;
  text: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

interface TodoListProps {
  todos: any[]; // Using any[] to match the DocBase[] type from Fireproof
  onToggleTodo: (todo: any) => Promise<void>;
  onDeleteTodo: (todo: any) => Promise<void>;
  onEditTodo: (todo: any, newText: string) => Promise<void>;
}

export const TodoList: React.FC<TodoListProps> = ({ todos, onToggleTodo, onDeleteTodo, onEditTodo }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');

  const handleStartEdit = (todo: any) => {
    setEditingId(todo._id);
    setEditText(todo.text);
  };

  const handleSaveEdit = (todo: any) => {
    if (editText.trim()) {
      onEditTodo(todo, editText);
    }
    setEditingId(null);
    setEditText('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent, todo: any) => {
    if (e.key === 'Enter') {
      handleSaveEdit(todo);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };
  if (todos.length === 0) {
    return (
      <p style={{ color: '#666', fontStyle: 'italic' }}>No todos yet. Add one above!</p>
    );
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {todos.map((todo) => (
        <li
          key={todo._id}
          style={{
            padding: '10px',
            margin: '5px 0',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => onToggleTodo(todo)}
            style={{ transform: 'scale(1.2)' }}
          />
          {editingId === todo._id ? (
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, todo)}
              onBlur={() => handleSaveEdit(todo)}
              autoFocus
              style={{
                flex: 1,
                padding: '5px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          ) : (
            <span
              style={{
                flex: 1,
                textDecoration: todo.completed ? 'line-through' : 'none',
                color: todo.completed ? '#666' : '#333',
                cursor: 'pointer'
              }}
              onClick={() => handleStartEdit(todo)}
              title="Click to edit"
            >
              {todo.text}
            </span>
          )}
          {editingId !== todo._id && (
            <button
              onClick={() => handleStartEdit(todo)}
              style={{
                padding: '5px 10px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                marginRight: '5px'
              }}
            >
              Edit
            </button>
          )}
          <button
            onClick={() => onDeleteTodo(todo)}
            style={{
              padding: '5px 10px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
};
