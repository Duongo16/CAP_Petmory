import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { ChatSessionService } from './chat-session.service';
import { ChatSessionDocument, ChatSide, ChatState } from './schemas/chat-session.schema';

const owner = new Types.ObjectId();
const staff = new Types.ObjectId();

function session(state: ChatState) {
  const one = {
    code: 'conversation',
    owner,
    state,
    staff: null as Types.ObjectId | null,
    turn: [] as { side: ChatSide; text: string }[],
    handoverNote: '',
    lastAt: new Date(),
    save: vi.fn(),
  };
  one.save.mockImplementation(async () => one);
  return one;
}

function setup(one: ReturnType<typeof session>, claimed: ReturnType<typeof session> | null = null) {
  const model = {
    findOne: vi.fn(() => ({ exec: vi.fn().mockResolvedValue(one) })),
    findOneAndUpdate: vi.fn(() => ({ exec: vi.fn().mockResolvedValue(claimed) })),
    exists: vi.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
  };
  const service = new ChatSessionService(
    model as unknown as Model<ChatSessionDocument>,
    null!, null!, null!, null!, null!, null!,
  );
  return { model, service };
}

describe('chat handover', () => {
  it('sends the typed note and lets the customer message before staff replies', async () => {
    const one = session(ChatState.BOT);
    const { service } = setup(one);

    await service.handover(one.code, owner.toString(), 'I need help with my order');
    expect(one.state).toBe(ChatState.WAITING);
    expect(one.turn.some((turn) => turn.side === ChatSide.USER && turn.text === 'I need help with my order')).toBe(true);

    const before = one.turn.length;
    await service.ask(one.code, owner.toString(), 'Can I change the color?');
    expect(one.turn.length).toBe(before + 1);
    expect(one.turn.at(-1)).toMatchObject({ side: ChatSide.USER, text: 'Can I change the color?' });
  });

  it('lets the first staff reply claim the conversation without a take step', async () => {
    const one = session(ChatState.WITH_STAFF);
    one.staff = staff;
    const { model, service } = setup(one, one);

    await service.reply(one.code, staff.toString(), 'I can help');
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { code: one.code, state: ChatState.WAITING, staff: null },
      { $set: { state: ChatState.WITH_STAFF, staff } },
      { new: true },
    );
    expect(one.turn.at(-1)).toMatchObject({ side: ChatSide.STAFF, text: 'I can help' });
  });

  it('keeps a second staff member from replying after the first claim', async () => {
    const one = session(ChatState.WITH_STAFF);
    one.staff = staff;
    const { service } = setup(one);

    await expect(service.reply(one.code, new Types.ObjectId().toString(), 'Hello')).rejects.toBeInstanceOf(ForbiddenException);
    expect(one.turn).toHaveLength(0);
  });

  it('does not let the old take endpoint replace the adviser who replied first', async () => {
    const one = session(ChatState.WITH_STAFF);
    one.staff = staff;
    const { service } = setup(one);

    await expect(service.take(one.code, new Types.ObjectId().toString())).rejects.toBeInstanceOf(BadRequestException);
    expect(one.staff).toEqual(staff);
  });
});
