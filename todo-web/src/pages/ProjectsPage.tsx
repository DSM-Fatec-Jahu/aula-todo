import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { projectsApi } from '../api/endpoints.ts';
import type { ProjectSummary } from '../api/types.ts';

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => projectsApi.list().then(setProjects), []);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await projectsApi.create({ name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (project: ProjectSummary) => {
    if (!window.confirm(`Excluir o projeto "${project.name}" e todas as suas tarefas e arquivos?`)) return;
    await projectsApi.remove(project.id);
    await load();
  };

  return (
    <main>
      <h1>Meus projetos</h1>

      <form className="inline-form wrap" onSubmit={create}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do projeto" required maxLength={120} aria-label="Nome do projeto" />
        <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição (opcional)" maxLength={2000} aria-label="Descrição" />
        <button type="submit" disabled={!name.trim()}>
          Criar projeto
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {projects === null && !error && <p className="muted">Carregando…</p>}
      {projects?.length === 0 && <p className="muted">Você ainda não tem projetos. Crie o primeiro acima.</p>}

      <div className="grid">
        {projects?.map((project) => (
          <article key={project.id} className="card">
            <h3>
              <Link to={`/projects/${project.id}`}>{project.name}</Link>
            </h3>
            {project.description && <p className="muted">{project.description}</p>}
            <p className="muted">
              {project.doneCount} de {project.taskCount} tarefas concluídas
            </p>
            <button type="button" className="link danger" onClick={() => void remove(project)}>
              Excluir
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}
