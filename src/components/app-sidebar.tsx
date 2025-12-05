import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { SettingsDialogArea } from "./settings-dialog-area";
import { Plus, MessageSquare, Trash, Settings } from "lucide-react";
import { type Chat } from "@/services/api";
import { useState } from "react";
import { DialogDescription } from "@radix-ui/react-dialog";

interface AppSidebarProps {
  chats: Chat[];
  currentChatId: number | null;
  onSelectChat: (chatId: number) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: number) => void;
}

const appName = import.meta.env.VITE_APP_NAME;
const appVersion = import.meta.env.VITE_APP_VERSION;

type DialogContentType = {
  title: string;
  component: React.ComponentType<{ onClose: () => void }>;
};

export function AppSidebar({
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: AppSidebarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
  const [activeDialog, setActiveDialog] = useState<DialogContentType | null>(
    null
  );

  const handleDeleteClick = (e: React.MouseEvent, chat: Chat) => {
    e.stopPropagation();
    setChatToDelete(chat);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (chatToDelete) {
      onDeleteChat(chatToDelete.id);
      setDeleteDialogOpen(false);
      setChatToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setChatToDelete(null);
  };

  const handleOpenSettingsDialog = (dialog: DialogContentType) => {
    setActiveDialog(dialog);
    setSettingsDialogOpen(true);
  };

  const handleCloseSettingsDialog = () => {
    setSettingsDialogOpen(false);
    setActiveDialog(null);
  };

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-2">
            <img
              src="/icon.svg"
              alt="Local AI Logo"
              className="h-8 w-8 rounded-full"
            />
            <h2 className="text-lg font-semibold absolute left-1/2 transform -translate-x-1/2">
              {appName}
            </h2>
            <Settings
              className="h-5 w-5 text-muted-foreground ml-auto cursor-pointer"
              onClick={() => {
                handleOpenSettingsDialog({
                  title: "Settings",
                  component: SettingsDialogArea,
                });
              }}
            />
          </div>
          <Button
            onClick={onNewChat}
            className="w-full justify-start gap-2 mt-2"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Recent Chats</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {chats.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    No chats yet. Start a new conversation!
                  </div>
                ) : (
                  chats.map((chat) => (
                    <SidebarMenuItem key={chat.id}>
                      <div className="group relative">
                        <SidebarMenuButton
                          onClick={() => onSelectChat(chat.id)}
                          isActive={currentChatId === chat.id}
                          className="w-full pr-8"
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span className="truncate">{chat.title}</span>
                        </SidebarMenuButton>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-opacity"
                          onClick={(e) => handleDeleteClick(e, chat)}
                        >
                          <Trash className="h-3 w-3" />
                          <span className="sr-only">Delete chat</span>
                        </Button>
                      </div>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {/* <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Settings className="h-4 w-4" />
                  <span>Preferences</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup> */}
        </SidebarContent>
        <SidebarFooter>
          <div className="p-2 text-xs text-muted-foreground">
            {appName} v{appVersion}
          </div>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              chat "{chatToDelete?.title}" and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-500 text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        {activeDialog && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-bold text-lg">
                {activeDialog.title}
              </DialogTitle>
              <DialogDescription>
                Update your settings below.
              </DialogDescription>
            </DialogHeader>
            <activeDialog.component onClose={handleCloseSettingsDialog} />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
