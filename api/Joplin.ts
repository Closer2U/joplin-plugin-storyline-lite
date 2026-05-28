/**
 * Minimal Joplin Plugin API type declarations for StoryLine
 */

export interface Plugin {
	plugins: {
		register(callback: { onStart(): Promise<void> }): void;
	};
}

export interface ViewHandle {}

export interface NoteEntity {
	id: string;
	title: string;
	body: string;
	parent_id: string;
}

export interface FolderEntity {
	id: string;
	title: string;
	parent_id?: string;
}

export interface Pagination<T> {
	items: T[];
	has_more: boolean;
}

export interface DataApi {
	get(path: string[], query?: Record<string, any>): Promise<any>;
	post(path: string[], query?: Record<string, any> | null, body?: Record<string, any>): Promise<any>;
	put(path: string[], query?: Record<string, any> | null, body?: Record<string, any>): Promise<any>;
	userDataGet(noteId: string, key: string): Promise<any>;
	userDataSet(noteId: string, key: string, value: any): Promise<void>;
}

export interface PanelsApi {
	create(id: string): Promise<ViewHandle>;
	setHtml(handle: ViewHandle, html: string): Promise<void>;
	addScript(handle: ViewHandle, path: string): Promise<void>;
	show(handle: ViewHandle, show?: boolean): Promise<void>;
	postMessage(handle: ViewHandle, message: any): Promise<void>;
	onMessage(handle: ViewHandle, callback: (msg: any) => Promise<any>): Promise<void>;
}

export interface ViewsApi {
	panels: PanelsApi;
}

export interface CommandsApi {
	register(command: { name: string; label: string; iconName?: string; execute(): Promise<void> }): Promise<void>;
	execute(name: string, ...args: any[]): Promise<any>;
}

export interface WorkspaceApi {
	selectedNote(): Promise<NoteEntity | null>;
}

export interface Joplin {
	plugins: Plugin['plugins'];
	data: DataApi;
	views: ViewsApi;
	commands: CommandsApi;
	workspace: WorkspaceApi;
}
