export interface Todo {
  _id?: string;
  text: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export const useTodos = (database: any) => {
  const handleAddTodo = async (text: string) => {
    if (!text.trim()) return;

    const newTodo: Todo = {
      text: text.trim(),
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    try {
      await database.put(newTodo);
    } catch (error) {
      console.error('Error adding todo:', error);
    }
  };

  const handleToggleTodo = async (todo: any) => {
    if (!todo._id) return;

    const updatedTodo = {
      ...todo,
      completed: !todo.completed,
      updatedAt: Date.now()
    };

    try {
      await database.put(updatedTodo);
    } catch (error) {
      console.error('Error toggling todo:', error);
    }
  };

  const handleDeleteTodo = async (todo: any) => {
    if (!todo._id) return;

    try {
      await database.del(todo._id);
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  };

  const handleEditTodo = async (todo: any, newText: string) => {
    if (!todo._id || !newText.trim()) return;

    const updatedTodo = {
      ...todo,
      text: newText.trim(),
      updatedAt: Date.now()
    };

    try {
      await database.put(updatedTodo);
    } catch (error) {
      console.error('Error editing todo:', error);
    }
  };

  return {
    handleAddTodo,
    handleToggleTodo,
    handleDeleteTodo,
    handleEditTodo
  };
};
