"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { SessionList } from "@/components/session-list";
import { ReplayView } from "@/components/replay-view";
import { ProjectView } from "@/components/project-view";
import { HomeLanding } from "@/components/home-landing";
import { ProjectConfigForm } from "@/components/project-config-form";
import { OnboardingStepper } from "@/components/onboarding-stepper";
import { listProjects, Project } from "@/lib/api";

const ONBOARDING_KEY = "shigawire:onboarding-complete";

export default function Home() {
  const [view, setView] = useState<"list" | "replay">("list");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [replayProjectId, setReplayProjectId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [sessionBacklogOpen, setSessionBacklogOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    loadProjects();
    try {
      if (!localStorage.getItem(ONBOARDING_KEY)) setShowOnboarding(true);
    } catch { /* SSR / restricted storage */ }
  }, []);

  async function loadProjects() {
    const fetched = await listProjects();
    setProjects(fetched);
  }

  const handleSessionSelect = (sessionId: string, projectId: string) => {
    setSelectedSessionId(sessionId);
    setReplayProjectId(projectId);
    setView("replay");
  };

  const handleProjectSelect = (projectId: string | null) => {
    setSelectedProjectId(projectId);
    setSessionBacklogOpen(false);
    setView("list");
  };

  const handleSelectHome = () => {
    setSelectedProjectId(null);
    setSessionBacklogOpen(false);
    setView("list");
  };

  const handleSelectSessionBacklog = () => {
    setSelectedProjectId(null);
    setSessionBacklogOpen(true);
    setView("list");
  };

  // Called when a new project is created via Sidebar
  const handleProjectCreated = (newProject: Project) => {
    setProjects((prev) => [newProject, ...prev]);
    handleProjectSelect(newProject.id);
  };

  // Called when ProjectView updates a project (rename)
  const handleProjectUpdated = (updatedProject: Project) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)),
    );
  };

  const handleProjectDeleted = async (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));

    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
      setSessionBacklogOpen(false);
      setView("list");
    }

    await loadProjects();
  };

  // bulk delete (used by Sidebar multi-select)
  const handleProjectsDeleted = async (deletedIds: string[]) => {
    setProjects((prev) => prev.filter((p) => !deletedIds.includes(p.id)));

    if (selectedProjectId && deletedIds.includes(selectedProjectId)) {
      setSelectedProjectId(null);
      setSessionBacklogOpen(false);
      setView("list");
    }

    await loadProjects();
  };

  // Determine main content based on state
  const renderContent = () => {
    if (view === "replay") {
      return (
        <ReplayView
          projectId={replayProjectId}
          sessionId={selectedSessionId}
          onBack={() => setView("list")}
        />
      );
    }

    if (selectedProjectId) {
      return (
        <ProjectView
          projectId={selectedProjectId}
          onSessionSelect={(sessionId) =>
            handleSessionSelect(sessionId, selectedProjectId)
          }
          onUpdateProject={handleProjectUpdated}
          onDeleteProject={handleProjectDeleted} // <- single
        />
      );
    }

    if (sessionBacklogOpen) {
      return (
        <SessionList
          onSessionSelect={(sessionId, projectId) =>
            handleSessionSelect(sessionId, projectId)
          }
        />
      );
    }

    return (
      <HomeLanding
        projects={projects}
        onSelectProject={(id) => handleProjectSelect(id)}
        onOpenBacklog={handleSelectSessionBacklog}
        onNewProject={() => setCreateProjectOpen(true)}
      />
    );
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 opacity-[0.06] [background:repeating-linear-gradient(180deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_1px,transparent_2px,transparent_6px)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,136,255,0.10)_0%,rgba(0,0,0,0.95)_55%,rgba(0,0,0,1)_100%)]" />
      <div className="relative flex flex-col h-full">
        <Header onShowGuide={() => setShowOnboarding(true)} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            projects={projects}
            selectedProjectId={selectedProjectId}
            sessionBacklogOpen={sessionBacklogOpen}
            onSelectHome={handleSelectHome}
            onSelectSessionBacklog={handleSelectSessionBacklog}
            onSelectProject={handleProjectSelect}
            onOpenCreateProject={() => setCreateProjectOpen(true)}
            onProjectsDeleted={handleProjectsDeleted}
          />
          {renderContent()}
        </div>
      </div>

      {createProjectOpen && (
        <ProjectConfigForm
          onCreate={(newProj) => {
            handleProjectCreated(newProj);
            setCreateProjectOpen(false);
          }}
          onClose={() => setCreateProjectOpen(false)}
        />
      )}

      {showOnboarding && (
        <OnboardingStepper
          onComplete={() => {
            setShowOnboarding(false);
            try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch {}
          }}
        />
      )}
    </div>
  );
}
