import React from 'react';

interface Todo {
  _id?: string;
  text: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

interface TodoListProps {
  todos: any[]; // Using any[] to match the DocBase[] type from Fireproof
  onToggleTodo: (todo: any) => void;
  onDeleteTodo: (todo: any) => void;
}

export const TodoList: React.FC<TodoListProps> = ({ todos, onToggleTodo, onDeleteTodo }) => {
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
          <span
            style={{
              flex: 1,
              textDecoration: todo.completed ? 'line-through' : 'none',
              color: todo.completed ? '#666' : '#333'
            }}
          >
            {todo.text}
          </span>
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
