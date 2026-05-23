// Mock Obsidian module for testing
export class App {
  vault = {
    read: jest.fn(),
    readBinary: jest.fn(),
    getAbstractFileByPath: jest.fn(),
    getFiles: jest.fn(() => []),
  };
  workspace = {
    on: jest.fn(),
    getLeavesOfType: jest.fn(() => []),
    getRightLeaf: jest.fn(),
    revealLeaf: jest.fn(),
    getActiveFile: jest.fn(),
  };
  secretStorage = {
    getSecret: jest.fn(),
    setSecret: jest.fn(),
  };
}

export class Plugin {
  settings: any;
  app: App;
  loadData = jest.fn();
  saveData = jest.fn();
  addCommand = jest.fn();
  addSettingTab = jest.fn();
  registerView = jest.fn();
  registerEvent = jest.fn();
}

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl = {
    empty: jest.fn(),
    createEl: jest.fn(),
  };
}

export class Notice {
  constructor(message: string) {}
}

export class TFile {
  path: string;
  name: string;
  extension: string;
  parent: any;

  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.extension = this.name.split('.').pop() || '';
  }
}

export class MarkdownView {
  file: TFile | null = null;
}

export class Menu {
  addItem = jest.fn((cb) => {
    cb({
      setTitle: jest.fn().mockReturnThis(),
      setIcon: jest.fn().mockReturnThis(),
      onClick: jest.fn().mockReturnThis(),
    });
    return this;
  });
}

export class WorkspaceLeaf {
  view: any;
  setViewState = jest.fn();
}

export const Setting = jest.fn().mockImplementation(() => ({
  setName: jest.fn().mockReturnThis(),
  setDesc: jest.fn().mockReturnThis(),
  addText: jest.fn().mockReturnThis(),
  addToggle: jest.fn().mockReturnThis(),
}));

export class Modal {
  app: App;
  open = jest.fn();
  close = jest.fn();
}

export class Editor {
  getCursor = jest.fn();
  setSelection = jest.fn();
  replaceRange = jest.fn();
}
