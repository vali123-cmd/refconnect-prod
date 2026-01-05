import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Info, Send, MoreVertical } from 'lucide-react';

export default function GroupDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([
        { id: 1, sender: 'Alice', text: 'Has the schedule for next week been released?', time: '10:00 AM', isMe: false },
        { id: 2, sender: 'Bob', text: 'Not yet, usually comes out on Tuesday.', time: '10:05 AM', isMe: false },
        { id: 3, sender: 'You', text: 'Thanks Bob. I need to block out Sunday morning.', time: '10:12 AM', isMe: true },
    ]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        setMessages([...messages, {
            id: Date.now(),
            sender: 'You',
            text: newMessage,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isMe: true
        }]);
        setNewMessage('');
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-180px)]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3 mb-2">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate('/groups')} className="p-1 hover:bg-secondary rounded-full md:hidden">
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="font-bold text-lg">Premier League Refs</h1>
                        <p className="text-xs text-muted-foreground">124 members</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="p-2 hover:bg-secondary rounded-full text-muted-foreground">
                        <Info className="h-5 w-5" />
                    </button>
                    <button className="p-2 hover:bg-secondary rounded-full text-muted-foreground">
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 p-2">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                        {!msg.isMe && <span className="text-xs text-muted-foreground ml-1 mb-0.5">{msg.sender}</span>}
                        <div
                            className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${msg.isMe
                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                : 'bg-secondary text-secondary-foreground rounded-bl-sm'}`}
                        >
                            {msg.text}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1 mx-1">{msg.time}</span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="mt-2 flex gap-2 border-t border-border pt-3 bg-background">
                <input
                    type="text"
                    className="flex-1 bg-secondary/50 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                />
                <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-2 bg-primary text-primary-foreground rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                    <Send className="h-4 w-4" />
                </button>
            </form>
        </div>
    );
}
