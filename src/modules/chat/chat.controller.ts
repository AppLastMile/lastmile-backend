import { Body, Controller, Post } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatService } from './chat.service';
import { Message } from './entities/message.entity';

@Controller('chat')
export class ChatController {
	constructor(private readonly chatService: ChatService) {}

	@Post('messages')
	createMessage(@Body() dto: CreateMessageDto): Promise<Message> {
		return this.chatService.createMessage(dto);
	}
}
